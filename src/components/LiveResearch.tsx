"use client";
/** Live sources for the current question. Real pages with links, never AI text. */
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Category } from "@/lib/vocab";
import type { LiveResult, SourceKind } from "@/lib/web/sources";
import { Badge, Button, Card, CardTitle, Notice, SkeletonCard, SkeletonGroup } from "./ui";

interface Payload {
  query: string;
  results: LiveResult[];
  unavailable: string[];
}

const GROUPS: { kind: SourceKind; title: string; hint: string }[] = [
  { kind: "study", title: "What research found", hint: "results reported by studies; check how well each fits you" },
  { kind: "experience", title: "What people who faced this said", hint: "personal answers, not verified" },
  { kind: "background", title: "Background", hint: "general information" },
];

export function LiveResearch({ query, category }: { query: string; category: Category }) {
  const [state, setState] = useState<{ key: string; data?: Payload; err?: string } | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const key = `${category}|${query}`;

  useEffect(() => {
    let live = true;
    api<Payload>("/api/live-research", { method: "POST", body: { q: query, category } })
      .then((data) => live && setState({ key, data }))
      .catch((e) => live && setState({ key, err: e instanceof Error ? e.message : String(e) }));
    return () => {
      live = false;
    };
  }, [key, query, category]);

  const cur = state?.key === key ? state : null;
  if (!cur)
    return (
      <SkeletonGroup className="space-y-3">
        <p className="text-sm text-muted">Researching live sources…</p>
        <SkeletonCard lines={3} />
      </SkeletonGroup>
    );
  if (cur.err) return <Notice tone="warn">Live research didn&apos;t work this time ({cur.err}). Your decision isn&apos;t affected.</Notice>;

  const { results, unavailable, query: used } = cur.data!;

  async function save(r: LiveResult) {
    try {
      await api("/api/web-references", { method: "POST", body: { url: r.url, title: r.title.slice(0, 300), snippet: r.snippet.slice(0, 1200), publisher: r.publisher, query: used.slice(0, 120) } });
      setSaved((s) => ({ ...s, [r.url]: true }));
    } catch {
      setSaved((s) => ({ ...s, [r.url]: false }));
    }
  }

  return (
    <Card className="space-y-5">
      <CardTitle hint={`searched for “${used}”`}>Live research</CardTitle>
      {results.length === 0 && <Notice tone="info">No live source matched these words. Go back with “Change question” and try simpler topic words.</Notice>}
      {GROUPS.map((g) => {
        const rows = results.filter((r) => r.kind === g.kind);
        if (!rows.length) return null;
        return (
          <section key={g.kind} aria-label={g.title} className="space-y-2">
            <h3 className="font-semibold">
              {g.title} <span className="text-xs font-normal text-muted">{g.hint}</span>
            </h3>
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.url} className="rounded-lg border border-line bg-surface p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <a href={r.url} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1 font-semibold hover:underline">
                      {r.title}
                    </a>
                    <Button variant="ghost" disabled={saved[r.url]} onClick={() => void save(r)}>
                      {saved[r.url] ? "Saved" : saved[r.url] === false ? "Try again" : "Save"}
                    </Button>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge className="border-accent bg-subtle text-accent">{r.publisher}</Badge>
                    <span className="text-xs text-muted">{r.detail}</span>
                  </div>
                  <Summary question={r.question} text={r.snippet} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {unavailable.length > 0 && <p className="text-xs text-muted">Not available right now: {unavailable.join(", ")}.</p>}
      <p className="text-xs text-muted">
        Summaries are the source&apos;s own words, shortened to 150 words at most (150 each for a question and its answer). They show what happened to others and don&apos;t predict your outcome. Real pages found by keyword, unverified and not matched to your situation by DecisionTrail. Wikipedia text is CC BY-SA 4.0; Stack Exchange content belongs to its authors (CC BY-SA).
      </p>
    </Card>
  );
}

const PREVIEW_WORDS = 40;

/** The source's own text: a short preview that opens to at most 150 words per part. */
function Summary({ question, text }: { question?: string; text: string }) {
  const [open, setOpen] = useState(false);
  if (!question && !text) return <p className="mt-2 text-muted">No summary available. Open the link to read it.</p>;
  const parts = [
    { label: question ? "Question" : null, text: question ?? "" },
    { label: question ? "Answer" : null, text },
  ].filter((p) => p.text);
  // Two parts share the preview, so a closed card stays about the same height.
  const limit = Math.round(PREVIEW_WORDS / parts.length);
  const isLong = (t: string) => t.split(" ").length > limit + 10;
  const long = parts.some((p) => isLong(p.text));
  return (
    <div className="mt-2 space-y-2">
      {parts.map((p) => (
        <p key={p.label ?? "text"} className="text-muted">
          {p.label && <strong className="font-semibold text-ink">{p.label}: </strong>}
          {!open && isLong(p.text) ? `${p.text.split(" ").slice(0, limit).join(" ")}…` : p.text}
        </p>
      ))}
      {long && (
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="py-1 font-semibold text-accent underline underline-offset-4">
          {open ? "Show less" : question ? "Read question and answer" : "Read summary"}
        </button>
      )}
    </div>
  );
}
