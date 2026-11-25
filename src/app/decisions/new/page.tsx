"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { InferenceBadge } from "@/components/marks";
import { LiveResearch } from "@/components/LiveResearch";
import { AskSkeleton, EvidenceStepSkeleton } from "@/components/skeletons";
import { MatchCard } from "@/components/MatchCard";
import { savedScope, ScopePicker, type Scope } from "@/components/ScopePicker";
import { ResearchPanel } from "@/components/ResearchPanel";
import { emptyDecision, StructureEditor } from "@/components/StructureEditor";
import { Button, Card, CardTitle, Field, Input, Notice, Spinner, Textarea, cn } from "@/components/ui";
import { extractDecision, type Where } from "@/lib/ai/tasks";
import { api } from "@/lib/api";
import { quickStructure } from "@/lib/quickStructure";
import { topicWords } from "@/lib/web/sources";
import { label } from "@/lib/vocab";
import type { MatchResult, StructuredDecision, SuccessCriterion } from "@/lib/types";

type Step = "ask" | "decide";

export default function NewDecisionPage() {
  // The router keeps this page alive after navigating away, so a saved form must be
  // thrown away explicitly. Otherwise it reopens filled in and can be saved twice.
  const [run, setRun] = useState(0);
  return (
    <Suspense
      fallback={<AskSkeleton />}
    >
      <NewDecision key={run} onSaved={() => setRun((n) => n + 1)} />
    </Suspense>
  );
}

function NewDecision({ onSaved }: { onSaved: () => void }) {
  const { me, aiStatus, error } = useAuth();
  const router = useRouter();
  const past = useSearchParams().get("past") === "1";
  const [step, setStep] = useState<Step>("ask");
  const [text, setText] = useState("");
  const [scope, setScope] = useState<Scope>(savedScope);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "warn" | "error" | "info"; msg: string } | null>(null);
  const [where, setWhere] = useState<Where | null>(null);
  const [d, setD] = useState<StructuredDecision>(emptyDecision());
  const [matches, setMatches] = useState<MatchResult[]>([]);

  // The shell already shows the error, so don't keep "loading" forever.
  if (!me) return error ? null : <AskSkeleton />;

  /** Structures the text (AI when it's ready, fixed rules otherwise) and looks up past decisions in one go. */
  async function ask() {
    setNotice(null);
    setWhere(null);
    let next = quickStructure(text, []);
    // Never start a multi-gigabyte model download from this button; Settings does that.
    if (aiStatus === "available" || me!.privacyMode !== "private") {
      setBusy("Structuring your decision…");
      try {
        const r = await extractDecision(text, me!.privacyMode);
        next = fromAi(r.data, next);
        setWhere(r.where);
      } catch {
        setNotice({ tone: "info", msg: "AI structuring wasn't available, so we sorted your decision with simple rules. Check the details below." });
      }
    }
    setD(next);
    await findPrecedent(next);
  }

  async function findPrecedent(x: StructuredDecision) {
    setBusy("Checking your past decisions…");
    try {
      const r = await api<{ matches: MatchResult[] }>("/api/match", {
        method: "POST",
        body: {
          category: x.category,
          decision_type: x.decision_type,
          title: x.title.slice(0, 160),
          context: x.context.slice(0, 2000),
          objective: x.objective,
          alternative_tags: x.alternatives.map((a) => a.tag).slice(0, 10),
          constraint_tags: x.constraints,
          facets: x.facets,
        },
      });
      setMatches(r.matches);
      setShowAll(false);
      setStep("decide");
    } catch (e) {
      setNotice({ tone: "error", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  const needsCountry = scope.local && scope.countries.length === 0;
  const ready = text.trim().length >= 10 && !needsCountry;
  const searchWords = topicWords(text).join(" ");

  return (
    <>
      <PageTitle title={past ? "Log a past decision" : "New decision"} subtitle="DecisionTrail shows evidence. It never decides for you or predicts your outcome." />
      <ol className="flex gap-6 text-sm">
        {(["ask", "decide"] as Step[]).map((x, i) => (
          <li key={x} aria-current={step === x ? "step" : undefined} className={cn("border-b-2 pb-1", step === x ? "border-brand font-semibold text-ink" : "border-transparent text-muted")}>
            {i + 1}. {x === "ask" ? "Ask" : "See evidence & decide"}
          </li>
        ))}
      </ol>
      {notice && <Notice tone={notice.tone}>{notice.msg}</Notice>}

      {step === "ask" && busy && <EvidenceStepSkeleton status={busy} local={scope.local} />}
      {step === "ask" && !busy && (
        <Card className="space-y-4">
          <CardTitle>{past ? "What did you decide?" : "What are you deciding?"}</CardTitle>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready) void ask();
            }}
          >
            <Textarea
              aria-label="Your decision"
              className="min-h-32"
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. I run a B2B SaaS for small clinics with a limited budget. Should we offer a free plan or a paid subscription?"
            />
            <ScopePicker value={scope} onChange={setScope} />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={!ready}>
                Find evidence
              </Button>
              {!ready && <span className="text-sm text-muted">{needsCountry ? "Choose at least one country to continue." : "Write one sentence to continue."}</span>}
            </div>
          </form>
          <p className="text-xs text-muted">
            {me.privacyMode === "private"
              ? "Private mode: AI runs only on this device. If it isn't ready, simple rules are used instead."
              : "Hybrid mode: on-device first; if that isn't possible, your text is sent to cloud Gemini, and the result is marked “Ran in the cloud”."}{" "}
            Your question goes to the DecisionTrail server to check your own past decisions, and saved decisions are stored there. Up to four topic words picked from your question, and any countries you choose, are sent through our server to Wikipedia, OpenAlex or Crossref, Stack Exchange and Hacker News. Names typed in lowercase may be included, so leave out anything private.
          </p>
        </Card>
      )}

      {step === "decide" && (
        <>
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{d.title}</CardTitle>
              <Button variant="ghost" onClick={() => setStep("ask")}>
                Change question
              </Button>
            </div>
            <p className="text-sm text-muted">
              {label(d.category)} · {d.alternatives.map((a) => a.label).filter(Boolean).join(" / ")} {where && <InferenceBadge where={where} />}
            </p>
            <details>
              <summary className="cursor-pointer text-sm font-medium text-accent">Not right? Edit details</summary>
              <div className="mt-3">
                <StructureEditor value={d} onChange={setD} onApprove={() => void findPrecedent(d)} approveLabel="Update evidence" />
              </div>
            </details>
            {busy && (
              <p className="text-sm text-muted">
                <Spinner /> {busy}
              </p>
            )}
          </Card>

          {searchWords.length >= 2 ? (
            <LiveResearch question={d.title} query={searchWords} category={d.category} countries={scope.local ? scope.countries : []} />
          ) : (
            <Notice tone="warn">There were no topic words to research online. Go back with “Change question” and describe the topic.</Notice>
          )}
          {matches.length > 0 && (
            <section className="space-y-3" aria-label="Your past decisions">
              <h2 className="font-semibold">Your past decisions on this</h2>
              {matches.slice(0, showAll ? matches.length : 3).map((m) => (
                <MatchCard key={m.targetId} m={m} current={{ title: d.title, context: d.context }} />
              ))}
              {!showAll && matches.length > 3 && (
                <Button variant="secondary" onClick={() => setShowAll(true)}>
                  Show all {matches.length}
                </Button>
              )}
            </section>
          )}
          <details>
            <summary className="cursor-pointer text-sm font-medium text-accent">AI research (optional)</summary>
            <div className="mt-3">
              <ResearchPanel decision={d} privateText={text} privacyMode={me.privacyMode} prominent={false} />
            </div>
          </details>

          <RecordStep
            key={d.alternatives.map((a) => a.label).join("|")}
            d={d}
            past={past}
            matchesShown={matches.length}
            onSaved={(id) => {
              router.push(`/decisions/${id}`);
              onSaved();
            }}
          />
        </>
      )}
    </>
  );
}

/** Turns the AI's reading into an editable decision. */
function fromAi(e: Awaited<ReturnType<typeof extractDecision>>["data"], basic: StructuredDecision): StructuredDecision {
  const useOwn = e.alternatives.length === 0;
  return {
    title: e.title || basic.title,
    category: e.category,
    decision_type: e.decision_type,
    context: e.context || basic.context,
    objective: e.objective,
    time_horizon: e.time_horizon,
    alternatives: useOwn ? basic.alternatives : e.alternatives.map((a) => ({ ...a, origin: "ai_extracted" as const })),
    constraints: e.constraints,
    assumptions: e.assumptions.map((t) => ({ text: t, origin: "ai_extracted" as const })),
    expected_benefits: e.expected_benefits,
    risks: e.risks,
    missing_information: e.missing_information,
    facets: { customer_segment: e.customer_segment, company_stage: e.company_stage },
    field_origins: Object.fromEntries(
      ["title", "category", "decision_type", "context", "objective", "time_horizon", ...(useOwn ? [] : ["alternatives"]), "constraints", "expected_benefits", "risks", "facets"].map((k) => [k, "ai_extracted" as const]),
    ),
  };
}

function addDays(n: number) {
  const x = new Date();
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
}

function RecordStep({ d, past, matchesShown, onSaved }: { d: StructuredDecision; past: boolean; matchesShown: number; onSaved: (id: string) => void }) {
  const options = d.alternatives.filter((a) => a.label.trim());
  const [chosen, setChosen] = useState<number | null>(null);
  const [reasons, setReasons] = useState("");
  const [expected, setExpected] = useState("");
  const [criteria, setCriteria] = useState<SuccessCriterion[]>([{ metric: "", target: "", by: addDays(90) }]);
  const [decidedAt, setDecidedAt] = useState(new Date().toISOString().slice(0, 10));
  const [reviewDate, setReviewDate] = useState(addDays(90));
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const { id } = await api<{ id: string }>("/api/decisions", {
        method: "POST",
        body: {
          title: d.title,
          category: d.category,
          decision_type: d.decision_type,
          context: d.context,
          objective: d.objective,
          time_horizon: d.time_horizon,
          facets: d.facets,
          constraints: d.constraints,
          expected_benefits: d.expected_benefits.filter(Boolean),
          risks: d.risks.filter(Boolean),
          alternatives: options,
          assumptions: d.assumptions.filter((a) => a.text.trim()),
          chosen_index: chosen,
          reasons,
          expected_outcome: expected,
          success_criteria: criteria.filter((c) => c.metric.trim()),
          decided_at: chosen !== null ? new Date(decidedAt).toISOString() : null,
          review_due_at: reviewDate ? new Date(reviewDate).toISOString() : null,
          field_origins: d.field_origins,
        },
      });
      onSaved(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4">
      <CardTitle hint={matchesShown ? `${matchesShown} of your past decisions will be linked to this record` : undefined}>Decide and save</CardTitle>
      <Field label="Your choice">
        <div className="space-y-1">
          {options.map((o, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <input type="radio" name="chosen" checked={chosen === i} onChange={() => setChosen(i)} />
              <span className="font-medium">{o.label}</span> <span className="text-muted">{o.description}</span>
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="radio" name="chosen" checked={chosen === null} onChange={() => setChosen(null)} /> Not decided yet (save as draft)
          </label>
        </div>
      </Field>
      <Field label="Why (your original reasoning, preserved as written)">
        <Textarea value={reasons} onChange={(e) => setReasons(e.target.value)} />
      </Field>
      <details>
        <summary className="cursor-pointer text-sm font-medium text-accent">Add expectation and success criteria (optional)</summary>
        <div className="mt-3 space-y-4">
      <Field label="What do you expect to happen?">
        <Textarea value={expected} onChange={(e) => setExpected(e.target.value)} />
      </Field>
      <Field label="Measurable success criteria">
        <div className="space-y-2">
          {criteria.map((c, i) => (
            <div key={i} className="grid gap-2 md:grid-cols-[1fr_1fr_10rem_auto]">
              <Input placeholder="Metric (e.g. paying customers)" value={c.metric} onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, metric: e.target.value } : x)))} />
              <Input placeholder="Target (e.g. 20)" value={c.target} onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)))} />
              <Input type="date" value={c.by} onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, by: e.target.value } : x)))} />
              <Button variant="ghost" aria-label="Remove criterion" onClick={() => setCriteria(criteria.filter((_, j) => j !== i))}>
                Remove
              </Button>
            </div>
          ))}
          <Button variant="ghost" onClick={() => setCriteria([...criteria, { metric: "", target: "", by: addDays(90) }])}>
            + Add criterion
          </Button>
        </div>
      </Field>
        </div>
      </details>
      <div className="grid gap-4 md:grid-cols-2">
        {past && (
          <Field label="When did you decide?">
            <Input type="date" value={decidedAt} onChange={(e) => setDecidedAt(e.target.value)} />
          </Field>
        )}
        <Field label="Review date">
          <div className="flex flex-wrap gap-2">
            <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
            {[14, 30, 90].map((n) => (
              <Button key={n} variant="secondary" onClick={() => setReviewDate(addDays(n))}>
                {n}d
              </Button>
            ))}
          </div>
          {past && <p className="text-xs text-muted">Logging a past decision? Set the review date to today and record the outcome on the next screen.</p>}
        </Field>
      </div>
      {err && <Notice tone="error">{err}</Notice>}
      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={saving}>
          {saving && <Spinner />} Save decision record
        </Button>
      </div>
    </Card>
  );
}
