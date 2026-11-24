"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { ActorProfiles } from "@/components/ActorProfiles";
import { OutcomeChip } from "@/components/marks";
import { OnlineSearch } from "@/components/OnlineSearch";
import { Badge, Card, CardTitle, Notice, Select, SkeletonCard, SkeletonGroup } from "@/components/ui";
import { api } from "@/lib/api";
import { CATEGORIES, OUTCOME_CATEGORIES, label, type OutcomeCategory } from "@/lib/vocab";

interface Source { id: string; url: string; publisher: string; sourceType: string; publishedAt: string | null; retrievedAt: string }
interface Claim { id: string; claimType: string; claimText: string; statedOrInferred: string; provenanceClass: string; sources: { sourceId: string; support: string; locator: string }[] }
interface Case {
  id: string;
  slug: string;
  title: string;
  category: string;
  decisionType: string;
  actorName: string;
  decisionDate: string | null;
  datePrecision: string;
  context: string;
  alternativesDocumented: string | null;
  decisionMade: string;
  reasonDocumented: string | null;
  observedOutcome: string;
  outcomeCategory: OutcomeCategory;
  observationPeriod: string;
  lessons: string;
  limitations: string;
  evidenceClassification: string;
  verifiedBy: string;
  lastVerifiedAt: string;
  sources: Source[];
  claims: Claim[];
}

const isDraft = (c: Case) => /pending human review/i.test(c.verifiedBy);

export default function ExplorerPage() {
  return (
    <Suspense
      fallback={
        <SkeletonGroup className="space-y-3">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </SkeletonGroup>
      }
    >
      <Explorer />
    </Suspense>
  );
}

function Explorer() {
  const { me } = useAuth();
  const focus = useSearchParams().get("case");
  const [cases, setCases] = useState<Case[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cat, setCat] = useState("all");
  const [outcome, setOutcome] = useState("all");
  // Opening another case by link (?case=) takes over from what was opened by hand.
  const [toggled, setToggled] = useState<{ focus: string | null; id: string | null }>({ focus, id: focus });
  const open = toggled.focus === focus ? toggled.id : focus;
  const isOpen = (c: Case) => open === c.id || open === c.slug;

  useEffect(() => {
    if (!me) return;
    api<{ cases: Case[] }>("/api/cases").then((r) => setCases(r.cases)).catch((e) => setErr(String(e.message ?? e)));
  }, [me]);

  const shown = useMemo(() => (cases ?? []).filter((c) => (cat === "all" || c.category === cat) && (outcome === "all" || c.outcomeCategory === outcome))
    // A case opened from a match or a saved decision comes first.
    .sort((a, b) => Number(b.id === focus || b.slug === focus) - Number(a.id === focus || a.slug === focus)), [cases, cat, outcome, focus]);

  return (
    <>
      <PageTitle title="Historical explorer" subtitle="Research drafts with linked sources, including failures and reversals. Not yet verified by a person: check the sources before relying on a case." />
      {err && <Notice tone="error">{err}</Notice>}
      <OnlineSearch />
      <div className="flex gap-2">
        <Select className="max-w-xs" options={["all", ...CATEGORIES]} labels={(v) => (v === "all" ? "All categories" : label(v))} value={cat} onChange={(e) => setCat(e.target.value)} />
        <Select className="max-w-xs" options={["all", ...OUTCOME_CATEGORIES]} labels={(v) => (v === "all" ? "All outcomes" : label(v))} value={outcome} onChange={(e) => setOutcome(e.target.value)} />
      </div>
      {cases && cases.length === 0 && (
        <Notice tone="info">The case library is empty. Add cases under data/cases/ (see _TEMPLATE.json) and run npm run db:seed-cases.</Notice>
      )}
      {!cases && !err && (
        <SkeletonGroup className="space-y-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </SkeletonGroup>
      )}
      <div className="space-y-3">
        {shown.map((c) => (
          <Card key={c.id} className="space-y-2">
            <button className="w-full text-left" onClick={() => setToggled({ focus, id: isOpen(c) ? null : c.id })} aria-expanded={isOpen(c)}>
              <div className="flex flex-wrap items-center gap-2">
                {isDraft(c) && <Badge className="border-amber-300 bg-amber-50 text-amber-800">Unverified draft</Badge>}
                <OutcomeChip value={c.outcomeCategory} />
                <Badge className="border-slate-300 text-slate-600">{label(c.category)}</Badge>
                <Badge className="border-slate-300 text-slate-600">Evidence: {label(c.evidenceClassification)}</Badge>
              </div>
              <h3 className="mt-1 font-semibold">{c.title}</h3>
              <p className="text-xs text-slate-500">
                {c.actorName} · {c.decisionDate ? (c.datePrecision === "year" ? c.decisionDate.slice(0, 4) : new Date(c.decisionDate).toLocaleDateString("en-US")) : "date not established"} · {isDraft(c) ? "sources retrieved" : "last verified"} {new Date(c.lastVerifiedAt).toLocaleDateString("en-US")}
              </p>
            </button>
            {isOpen(c) && (
              <div className="space-y-3 border-t border-slate-200 pt-3 text-sm">
                <ActorProfiles slug={c.slug} />
                <KV k="Context" v={c.context} />
                <KV k="Alternatives considered" v={c.alternativesDocumented ?? "Not documented"} />
                <KV k="Decision" v={c.decisionMade} />
                <KV k="Documented reason" v={c.reasonDocumented ?? "Not documented"} />
                <KV k={"Observed outcome" + (c.observationPeriod ? ` (${c.observationPeriod})` : "")} v={c.observedOutcome} />
                <KV k="Lessons and implications" v={c.lessons} />
                <KV k="Limitations" v={c.limitations} />
                <div>
                  <CardTitle>Claims and their sources</CardTitle>
                  <ul className="space-y-2">
                    {c.claims.map((cl) => (
                      <li key={cl.id}>
                        <Badge className="mr-1 border-slate-300 text-slate-600">{label(cl.claimType)}</Badge>
                        <span className={cl.statedOrInferred === "inferred" ? "ai-text" : undefined}>{cl.claimText}</span>{" "}
                        <span className="text-xs text-slate-500">({label(cl.provenanceClass)})</span>
                        {cl.sources.some((s) => s.support === "contradicts") && <Badge className="ml-1 border-red-300 text-red-700">Sources disagree</Badge>}
                        {cl.sources.map((s) => {
                          const src = c.sources.find((x) => x.id === s.sourceId);
                          return src ? (
                            <a key={s.sourceId} href={src.url} target="_blank" rel="noreferrer noopener" className="ml-1 rounded bg-slate-100 px-1.5 text-xs hover:underline">
                              📄 {src.publisher}
                              {s.support !== "supports" ? ` (${s.support})` : ""}
                            </a>
                          ) : null;
                        })}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase text-slate-500">{k}</div>
      <p>{v || "—"}</p>
    </div>
  );
}
