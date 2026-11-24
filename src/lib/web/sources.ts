/**
 * Pure helpers for live research across free, keyless sources: OpenAlex
 * (studies), Stack Exchange and Hacker News (experiences), Wikipedia (background).
 * No AI: every result is a real page with a link.
 */
import type { Category } from "../vocab";
import { cleanSnippet, type WebResult } from "./wikipedia";

export type SourceKind = "study" | "experience" | "background";
export interface LiveResult extends WebResult {
  kind: SourceKind;
  /** Short factual detail, e.g. "2020 · cited 91 times". */
  detail: string;
}

const STOP = new Set(
  "a about after again all also am an and any are as at attend attending be because been being before between both but by can choose choosing could decide deciding decision did do does doing don each either else etc first for from get give go going had has have having he help her here him his how i if in into is it its just know let like ll make maybe me month months more most much my need new no not now of off offer offering on one only option options or our out over own people per please possible program question really right run said second see she should so some still such take taking than that the their them then there these they thing think this third those through to too try trying under until up us use using ve very want wanted was way we week well were what when where whether which while who why will with without wonder would year years yes yet you your".split(" "),
);

/** Topic words only: drops names, numbers, emails, links and filler, so little of the private text leaves. */
export function topicWords(text: string, options: string[] = [], max = 4): string[] {
  const clean = text.replace(/\S+@\S+|https?:\/\/\S+|www\.\S+/g, " ");
  const sentences = clean.split(/(?<=[.!?])\s+|\n|(?<=[.!?])(?=(?:should|do|is|can|i|we|what|which|how|would)\b)/i);
  const words = (s: string) =>
    s
      .split(/[^\p{L}\p{N}'-]+/u)
      // A capital after the first word is usually a name; keep acronyms like SaaS, B2B or AI.
      .filter((w, i) => !(i > 0 && /^\p{Lu}\p{Ll}+$/u.test(w)))
      .map((w) => w.toLowerCase().replace(/'s$|[^\p{L}\p{N}-]/gu, ""))
      .filter((w) => w.length > 2 && !/^\d/.test(w) && !STOP.has(w));
  const question = sentences.filter((s) => /\?|\b(should|choose|choosing|whether)\b/i.test(s));
  const rest = sentences.filter((s) => !question.includes(s));
  const ordered = [...options.flatMap(words), ...question.flatMap(words), ...rest.flatMap(words)];
  return [...new Set(ordered)].slice(0, max);
}

/** Matches a word and its simple endings; short words need more care ("plan" is not "plants"). */
function matcher(word: string): (w: string) => boolean {
  const base = word.toLowerCase().replace(/^(.{3,}?)(ing|s)$/, "$1");
  if (base.length > 4) return (w) => w.startsWith(base.slice(0, Math.max(4, Math.min(6, base.length - 2))));
  const endings = new Set(["", "s", "e", "es", "ed", "er", "ing", base.slice(-1) + "ing", base.slice(-1) + "ed"].map((x) => base + x));
  return (w) => endings.has(w);
}

/** Keeps results whose title contains at least `min` topic words (matched from the word start), best first. */
export function relevant<T extends { title: string }>(rows: T[], query: string, limit: number, min = 2): T[] {
  const stems = [...new Set(query.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1).map((w) => w.toLowerCase()))].map(matcher);
  const need = Math.min(min, stems.length);
  return rows
    .map((r, i) => {
      const words = r.title.toLowerCase().split(/[^\p{L}\p{N}]+/u);
      return { r, i, n: stems.filter((x) => words.some(x)).length };
    })
    .filter((x) => x.n > 0 && x.n >= need)
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.r);
}

/** True when `b` is `a` with one letter added, removed or changed. */
function oneLetterApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1 || a === b) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  let j = 0;
  while (j < Math.min(a.length, b.length) - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
  return Math.max(a.length, b.length) - i - j <= 1;
}

/**
 * Accepts a search engine's spelling suggestion only for a clear typo: hardly any
 * results as typed, and one letter of difference in long words. Otherwise "move"
 * becomes "movie" and "renting" becomes "reading".
 */
export function safeCorrection(query: string, suggestion: unknown, totalHits: number): string {
  if (typeof suggestion !== "string" || totalHits > 20) return query;
  const a = query.toLowerCase().split(/\s+/);
  const b = suggestion.toLowerCase().trim().split(/\s+/);
  const ok = a.length === b.length && a.every((w, i) => w === b[i] || (w.length >= 6 && /^[\p{L}-]+$/u.test(b[i]) && oneLetterApart(w, b[i])));
  return ok ? b.join(" ") : query;
}

const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : 0);

/** OpenAlex stores abstracts as {word: [positions]}. Returns the first `max` words. */
export function abstractStart(index: unknown, max = 45): string {
  if (!index || typeof index !== "object") return "";
  const out: string[] = [];
  for (const [w, pos] of Object.entries(index as Record<string, number[]>)) if (Array.isArray(pos)) for (const p of pos) if (p < max) out[p] = w;
  return cleanSnippet(out.filter(Boolean).join(" "));
}

export function parseOpenAlex(json: unknown): LiveResult[] {
  return arr((json as { results?: unknown })?.results).flatMap((w) => {
    const title = cleanSnippet(str(w.display_name));
    const url = str(w.doi) || str(w.id);
    if (!title || !url || /promo|coupon|\d+% (off|discount)/i.test(title)) return [];
    return [{ kind: "study" as const, title, url, snippet: abstractStart(w.abstract_inverted_index), publisher: "OpenAlex", detail: `${num(w.publication_year) || "Year unknown"} · cited ${num(w.cited_by_count)} times` }];
  });
}

export function parseStackExchange(json: unknown, site: string): LiveResult[] {
  return arr((json as { items?: unknown })?.items).flatMap((q) => {
    const title = cleanSnippet(str(q.title));
    const url = str(q.link);
    if (!title || !url) return [];
    return [{ kind: "experience" as const, title, url, snippet: "", publisher: `Stack Exchange (${site})`, detail: `${num(q.answer_count)} answers · score ${num(q.score)}` }];
  });
}

export function parseHackerNews(json: unknown): LiveResult[] {
  return arr((json as { hits?: unknown })?.hits).flatMap((h) => {
    const title = cleanSnippet(str(h.title));
    if (!title || !str(h.objectID) || num(h.num_comments) < 3) return [];
    return [{ kind: "experience" as const, title, url: `https://news.ycombinator.com/item?id=${encodeURIComponent(str(h.objectID))}`, snippet: "", publisher: "Hacker News", detail: `${num(h.num_comments)} comments · ${str(h.created_at).slice(0, 4)}` }];
  });
}

export function stackSites(category: Category): string[] {
  if (category === "education") return ["academia", "workplace"];
  if (category === "technology") return ["softwareengineering"];
  if (category === "personal") return ["money", "interpersonal"];
  if (category === "operations") return ["workplace", "pm"];
  return ["workplace"];
}

/** Hosts a saved reference may point to: exactly the ones live research returns. */
export function isLiveSourceUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return ["wikipedia.org", "doi.org", "openalex.org", "stackexchange.com", "news.ycombinator.com"].some((h) => u.hostname === h || u.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}
