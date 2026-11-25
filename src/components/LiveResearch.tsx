"use client";
/** Live sources for the current question. The cards are real pages with links; AI text appears only in EvidenceBrief. */
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Category } from "@/lib/vocab";
import { countriesOf, type Located } from "@/lib/web/countries";
import type { LiveResult, SourceKind } from "@/lib/web/sources";
import { Flag } from "./CountrySearch";
import { EvidenceBrief } from "./EvidenceBrief";
import { LiveResearchSkeleton } from "./skeletons";
import { Badge, Button, Card, CardTitle, Notice } from "./ui";

interface Payload {
  query: string;
  results: LiveResult[];
  unavailable: string[];
  local?: { names: string; found: number; missing: string };
}

const GROUPS: { kind: SourceKind; title: string; hint: string }[] = [
  { kind: "study", title: "What research found", hint: "results reported by studies; check how well each fits you" },
  { kind: "experience", title: "What people who faced this said", hint: "personal answers, not verified" },
  { kind: "background", title: "Background", hint: "general information" },
];

/** `countries` empty means World. */
export function LiveResearch({ question, query, category, countries }: { question: string; query: string; category: Category; countries: string[] }) {
  const [state, setState] = useState<{ key: string; data?: Payload; err?: string } | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const places = countries.join(",");
  const key = `${category}|${places}|${query}`;

  useEffect(() => {
    let live = true;
    api<Payload>("/api/live-research", { method: "POST", body: { q: query, category, countries: places ? places.split(",") : [] } })
      .then((data) => live && setState({ key, data }))
      .catch((e) => live && setState({ key, err: e instanceof Error ? e.message : String(e) }));
    return () => {
      live = false;
    };
  }, [key, query, category, places]);

  const cur = state?.key === key ? state : null;
  if (!cur) return <LiveResearchSkeleton local={countries.length > 0} />;
  if (cur.err) return <Notice tone="warn">Live research didn&apos;t work this time ({cur.err}). Your decision isn&apos;t affected.</Notice>;

  const { results, unavailable, query: used, local } = cur.data!;

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
      {local && (
        <Notice tone={local.found < 3 ? "warn" : "info"}>
          {local.found === 0
            ? `No evidence found that mentions ${local.names}. Showing other results, closest first.`
            : local.found < 3
              ? `Little evidence found that mentions ${local.names} (${local.found}). Other results fill the list, closest first.`
              : `${local.found} results mention ${local.names}.`}{" "}
          {local.found > 0 && local.missing && `None of the results shown mention ${local.missing}. `}
          Countries are matched by words, so it is not ensured that a result applies to your country. English sources only.
        </Notice>
      )}
      {results.length === 0 && <Notice tone="info">No live source matched these words. Go back with “Change question” and try simpler topic words.</Notice>}
      <EvidenceBrief key={key} question={question} results={results} />
      {GROUPS.map((g) => {
        const rows = results.filter((r) => r.kind === g.kind);
        if (!rows.length) return null;
        return (
          <section key={g.kind} aria-label={g.title} className="space-y-2">
            <h3 className="font-semibold">
              {g.title} <span className="text-xs font-normal text-muted">{g.hint}</span>
            </h3>
            <ul className="space-y-2">
              {rows.map((r, i) => (
                <li key={r.url} style={{ animationDelay: `${Math.min(i, 6) * 70}ms` }} className="enter rounded-lg border border-line bg-surface p-3 text-sm transition-colors hover:border-accent">
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
                  {r.located && <CountryLine located={r.located} note={!r.place} />}
                  {r.place && <p className={r.place.closeness === "country" ? "mt-1 text-xs font-medium text-accent" : "mt-1 text-xs font-medium text-signal"}>{r.place.text}</p>}
                  <QuestionAnswer question={r.question || r.title} answer={r.snippet} />
                  {r.credits && (
                    <p className="mt-2 text-xs text-muted">
                      {r.credits.map((c, i) => (
                        <span key={c.role}>
                          {i > 0 && " · "}
                          {c.role} by{" "}
                          {c.url ? (
                            <a href={c.url} target="_blank" rel="noreferrer noopener" className="underline">
                              {c.name}
                            </a>
                          ) : (
                            c.name
                          )}{" "}
                          ({c.licence})
                        </span>
                      ))}
                      , shortened
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {unavailable.length > 0 && <p className="text-xs text-muted">Not available right now: {unavailable.join(", ")}.</p>}
      <p className="text-xs text-muted">
        Questions and answers are the source&apos;s own words, shortened to at most 150 words each (70 for studies, whose abstracts belong to their publishers). A study&apos;s question is its stated aim, or its title. Wikipedia questions are written by DecisionTrail. They show what happened to others and don&apos;t predict your outcome. Real pages found by keyword, unverified and not matched to your situation by DecisionTrail. Wikipedia text is CC BY-SA 4.0, shortened; its authors are listed in each page&apos;s history.
      </p>
    </Card>
  );
}

const BASIS: Record<Located["basis"], string> = {
  title: "named in the title, not ensured",
  text: "mentioned in the text, not ensured",
  authors: "where the authors are based, not ensured",
  none: "",
};

/** Flag and name of the country a result seems to be about. Local results carry their own note. */
function CountryLine({ located, note }: { located: Located; note: boolean }) {
  const found = countriesOf(located.codes);
  if (!found.length) return note ? <p className="mt-1 text-xs text-muted">Country: not stated</p> : null;
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {found.map((c) => (
        <span key={c.code} className="inline-flex items-center gap-1.5 font-semibold text-ink">
          <Flag code={c.code} /> {c.name}
        </span>
      ))}
      {(note || located.basis === "authors") && <span className="text-xs text-muted">{BASIS[located.basis]}</span>}
    </p>
  );
}

const PREVIEW_WORDS = 20;

const NO_ANSWER = "Not available here. Open the link to read it.";

/** Question, then answer, in the source's own words: short previews that open to at most 150 words each. */
function QuestionAnswer({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const parts = [
    { label: "Question", text: question },
    { label: "Answer", text: answer || NO_ANSWER },
  ];
  const isLong = (t: string) => t.split(" ").length > PREVIEW_WORDS + 8;
  return (
    <div className="mt-2 space-y-2">
      {parts.map((p) => (
        <p key={p.label} className="text-muted">
          <strong className="font-semibold text-ink">{p.label}: </strong>
          {!open && isLong(p.text) ? `${p.text.split(" ").slice(0, PREVIEW_WORDS).join(" ")}…` : p.text}
        </p>
      ))}
      {parts.some((p) => isLong(p.text)) && (
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="py-1 font-semibold text-accent underline underline-offset-4">
          {open ? "Show less" : "Read question and answer"}
        </button>
      )}
    </div>
  );
}
