"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { DemoBadge, MatchBadge, OriginChip, OutcomeChip } from "@/components/marks";
import { Badge, Button, Card, CardTitle, Field, Input, Notice, Select, Skeleton, SkeletonCard, SkeletonGroup, Spinner, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import { reviewIcs } from "@/lib/ics";
import { useLanguage } from "@/lib/i18n";
import type { FieldOrigin, MatchLabel } from "@/lib/types";
import { OUTCOME_STATUSES, label, type OutcomeStatus } from "@/lib/vocab";

interface Detail {
  record: {
    id: string;
    title: string;
    category: string;
    decisionType: string;
    context: string;
    objective: string;
    status: string;
    chosenOptionId: string | null;
    reasons: string;
    expectedOutcome: string;
    successCriteria: { metric: string; target: string; by: string }[];
    decidedAt: string | null;
    reviewDueAt: string | null;
    isDemo: boolean;
    fieldOrigins: Record<string, FieldOrigin>;
  };
  options: { id: string; label: string; description: string; alternativeTag: string; origin: FieldOrigin }[];
  assumptions: { id: string; text: string; origin: FieldOrigin; reviewResult: "held" | "failed" | "unclear" | null; reviewNote: string | null }[];
  versions: { versionNo: number; changedAt: string; changeReason: string }[];
  reviews: {
    review: { id: string; reviewedAt: string; whatHappened: string; unexpectedEvents: string; wouldDoDifferently: string; lessons: string; processChecklist: Record<string, boolean> };
    outcome: { outcomeStatus: OutcomeStatus; criteriaResults: { metric: string; result: string }[] } | null;
  }[];
  matches: { id: string; label: MatchLabel; externalCaseId: string | null; personalDecisionId: string | null; caseTitle: string | null; personalTitle: string | null; score: string }[];
}

const PROCESS = {
  considered_alternatives: "I considered the alternatives available at the time",
  checked_evidence: "I checked the evidence available at the time",
  named_risks: "I named the main risks",
  set_criteria: "I set success criteria in advance",
};

export default function DecisionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { me } = useAuth();
  const { language, t } = useLanguage();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const load = useCallback(() => {
    api<Detail>(`/api/decisions/${id}`).then(setD).catch((e) => setErr(String(e.message ?? e)));
  }, [id]);
  useEffect(() => {
    if (me) load();
  }, [me, load]);

  if (err) return <Notice tone="error">{err}</Notice>;
  if (!d)
    return (
      <SkeletonGroup className="space-y-4">
        <Skeleton className="h-9 w-1/2" />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
      </SkeletonGroup>
    );

  const r = d.record;
  const chosen = d.options.find((o) => o.id === r.chosenOptionId);
  const latest = d.reviews[0];
  const due = r.reviewDueAt ? new Date(r.reviewDueAt) : null;
  const reviewOpen = !latest && r.status !== "draft";

  return (
    <>
      <PageTitle title={r.title} subtitle={`${t(label(r.category))} · ${t(label(r.decisionType))}`} actions={r.isDemo ? <DemoBadge /> : undefined} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="space-y-3 md:col-span-2">
          <CardTitle hint={`v${d.versions.at(-1)?.versionNo ?? 1} · ${t("original preserved")}`}>Decision record</CardTitle>
          <p className="text-sm text-slate-700">{r.context}</p>
          <div>
            <div className="text-xs font-medium uppercase text-slate-500">{t("Options")}</div>
            <ul className="space-y-1 text-sm">
              {d.options.map((o) => (
                <li key={o.id} className="flex items-center gap-2">
                  {o.id === r.chosenOptionId ? <Badge className="border-slate-900 bg-slate-900 text-white">Chosen</Badge> : <span className="w-14" />}
                  <span className="font-medium">{o.label}</span> <span className="text-slate-500">{o.description}</span> <OriginChip origin={o.origin} />
                </li>
              ))}
            </ul>
          </div>
          <Block title="Reasoning (as written at decision time)" text={r.reasons} />
          <Block title="Expected outcome" text={r.expectedOutcome} />
          {r.successCriteria.length > 0 && (
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">{t("Success criteria")}</div>
              <ul className="list-inside list-disc text-sm">
                {r.successCriteria.map((c, i) => (
                  <li key={i}>
                    {c.metric}: {c.target} by {c.by}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <div className="text-xs font-medium uppercase text-slate-500">{t("Assumptions")}</div>
            <ul className="space-y-1 text-sm">
              {d.assumptions.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  {a.reviewResult === "held" ? "✓" : a.reviewResult === "failed" ? "✗" : a.reviewResult === "unclear" ? "?" : "•"} {a.text} <OriginChip origin={a.origin} />
                </li>
              ))}
            </ul>
          </div>
        </Card>
        <Card className="space-y-3">
          <CardTitle>Status</CardTitle>
          <p className="text-sm">{t(label(r.status))}</p>
          <p className="text-sm text-slate-600">{t("Decided: ")}{r.decidedAt ? new Date(r.decidedAt).toLocaleDateString(language === "my" ? "my-MM" : "en-US") : "—"}</p>
          <p className="text-sm text-slate-600">{t("Review due: ")}{due ? due.toLocaleDateString(language === "my" ? "my-MM" : "en-US") : "—"}</p>
          <OutcomeChip value={latest?.outcome?.outcomeStatus} />
          {due && reviewOpen && (
            <Button variant="secondary" onClick={() => downloadReminder(r.id, r.title, due)}>
              📅 Add review to calendar
            </Button>
          )}
          <div>
            <div className="text-xs font-medium uppercase text-slate-500">{t("Precedent consulted")}</div>
            {d.matches.length === 0 ? (
            <p className="text-sm text-slate-500">{t("None recorded")}</p>
            ) : (
              <ul className="space-y-1">
                {d.matches.map((m) => (
                  <li key={m.id} className="text-sm">
                    <MatchBadge label={m.label} />{" "}
                    <Link className="underline" href={m.externalCaseId ? `/explorer?case=${m.externalCaseId}` : `/decisions/${m.personalDecisionId}`}>
                      {m.caseTitle ?? m.personalTitle ?? t(m.externalCaseId ? "library case" : "your decision")}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {latest && (
        <Card className="space-y-3">
          <CardTitle hint={`${t("reviewed ")}${new Date(latest.review.reviewedAt).toLocaleDateString(language === "my" ? "my-MM" : "en-US")}`}>Expected vs actual</CardTitle>
          <div className="grid gap-4 md:grid-cols-2">
            <Block title="You expected (frozen at decision time)" text={r.expectedOutcome} />
            <Block title="What actually happened" text={latest.review.whatHappened} />
          </div>
          {latest.outcome?.criteriaResults.length ? (
            <ul className="text-sm">
              {latest.outcome.criteriaResults.map((c, i) => (
                <li key={i}>
                  {c.metric}: <strong>{label(c.result)}</strong>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="grid gap-4 md:grid-cols-3">
            <Block title="Unexpected events" text={latest.review.unexpectedEvents} />
            <Block title="Would do differently" text={latest.review.wouldDoDifferently} />
            <Block title="Lessons" text={latest.review.lessons} />
          </div>
          {Object.keys(latest.review.processChecklist).length > 0 && (
            <div className="text-sm">
              <div className="text-xs font-medium uppercase text-slate-500">{t("Process quality (judged separately from the outcome)")}</div>
              {Object.entries(PROCESS).map(([k, item]) => (
                <div key={k}>
                  {latest.review.processChecklist[k] ? "✓" : "–"} {t(item)}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {r.status === "draft" && <DecideDraft d={d} onDone={load} />}
      {reviewOpen && <ReviewWizard d={d} overdue={!due || due.getTime() <= now} onDone={load} chosenLabel={chosen?.label} />}
    </>
  );
}

function downloadReminder(id: string, title: string, due: Date) {
  const url = `${window.location.origin}/decisions/${id}`;
  const href = URL.createObjectURL(new Blob([reviewIcs({ id, title, due, url, now: new Date() })], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = href;
  a.download = "decision-review.ics";
  a.click();
  URL.revokeObjectURL(href);
}

function inDays(n: number) {
  const x = new Date();
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
}

/** A draft has no choice yet. This records it, so the decision can be reviewed later. */
function DecideDraft({ d, onDone }: { d: Detail; onDone: () => void }) {
  const { t } = useLanguage();
  const [choice, setChoice] = useState<string | null>(null);
  const [reasons, setReasons] = useState(d.record.reasons);
  const [expected, setExpected] = useState(d.record.expectedOutcome);
  const [reviewDate, setReviewDate] = useState(inDays(90));
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setErr(null);
    try {
      await api(`/api/decisions/${d.record.id}/decide`, {
        method: "POST",
        body: { chosen_option_id: choice, reasons, expected_outcome: expected, review_due_at: new Date(reviewDate).toISOString() },
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4">
      <CardTitle hint="your draft is kept as version 1">I&apos;ve decided now</CardTitle>
      <div className="space-y-1" role="radiogroup" aria-label={t("Your choice")}>
        {d.options.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-sm">
            <input type="radio" name="draft-choice" checked={choice === o.id} onChange={() => setChoice(o.id)} />
            <span className="font-medium">{o.label}</span> <span className="text-slate-500">{o.description}</span>
          </label>
        ))}
      </div>
      <Field label="Why (your original reasoning, preserved as written)">
        <Textarea value={reasons} onChange={(e) => setReasons(e.target.value)} />
      </Field>
      <Field label="What do you expect to happen?">
        <Textarea value={expected} onChange={(e) => setExpected(e.target.value)} />
      </Field>
      <Field label="Review date">
        <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className="max-w-xs" />
      </Field>
      {err && <Notice tone="error">{err}</Notice>}
      <div className="flex justify-end">
        <Button disabled={saving || !choice || !reasons.trim() || !reviewDate} onClick={() => void submit()}>
          {saving && <Spinner />} {t("Save my decision")}
        </Button>
      </div>
    </Card>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  const { t } = useLanguage();
  return (
    <div>
      <div className="text-xs font-medium uppercase text-slate-500">{t(title)}</div>
      <p className="whitespace-pre-wrap text-sm">{text || "—"}</p>
    </div>
  );
}

function ReviewWizard({ d, overdue, onDone, chosenLabel }: { d: Detail; overdue: boolean; onDone: () => void; chosenLabel?: string }) {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [what, setWhat] = useState("");
  const [status, setStatus] = useState<OutcomeStatus>("achieved");
  const [criteria, setCriteria] = useState(d.record.successCriteria.map((c) => ({ metric: c.metric, result: "unknown" as "met" | "partly" | "not_met" | "unknown" })));
  const [assumptions, setAssumptions] = useState(d.assumptions.map((a) => ({ id: a.id, result: "unclear" as "held" | "failed" | "unclear", note: "" })));
  const [unexpected, setUnexpected] = useState("");
  const [differently, setDifferently] = useState("");
  const [lessons, setLessons] = useState("");
  const [process, setProcess] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setErr(null);
    try {
      await api(`/api/decisions/${d.record.id}/review`, {
        method: "POST",
        body: {
          what_happened: what,
          unexpected_events: unexpected,
          would_do_differently: differently,
          lessons,
          outcome_status: status,
          process_checklist: process,
          assumption_results: assumptions,
          criteria_results: criteria,
          evidence_links: [],
        },
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <Card className={overdue ? "space-y-4 border-amber-300" : "space-y-4"}>
      <CardTitle hint={`step ${page} of 3`}>{overdue ? "This decision is due for review" : "Record the outcome early"}</CardTitle>
      <p className="text-xs text-slate-500">{t("A good decision can have a bad outcome, and a poor one can get lucky. You'll judge outcome and process separately.")}</p>

      {page === 1 && (
        <>
          <Field label={`${t("What actually happened")}${chosenLabel ? ` (${chosenLabel})` : ""}?`}>
            <Textarea value={what} onChange={(e) => setWhat(e.target.value)} />
          </Field>
          <Field label="Did the expected outcome occur?">
              <Select options={OUTCOME_STATUSES} labels={label} value={status} onChange={(e) => setStatus(e.target.value as OutcomeStatus)} />
          </Field>
          {criteria.map((c, i) => (
              <Field key={i} label={`${t("Criterion")}: ${c.metric}`}>
              <Select options={["met", "partly", "not_met", "unknown"]} labels={label} value={c.result} onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, result: e.target.value as typeof x.result } : x)))} />
            </Field>
          ))}
        </>
      )}

      {page === 2 && (
        <>
          {d.assumptions.length === 0 && <p className="text-sm text-slate-500">{t("No assumptions were recorded.")}</p>}
          {d.assumptions.map((a, i) => (
            <div key={a.id} className="grid gap-2 md:grid-cols-[1fr_10rem_1fr]">
              <span className="text-sm">{a.text}</span>
              <Select options={["held", "failed", "unclear"]} labels={label} value={assumptions[i].result} onChange={(e) => setAssumptions(assumptions.map((x, j) => (j === i ? { ...x, result: e.target.value as typeof x.result } : x)))} />
              <Textarea className="min-h-10" placeholder="Note (optional)" value={assumptions[i].note} onChange={(e) => setAssumptions(assumptions.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />
            </div>
          ))}
          <Field label="What unexpected events occurred?">
            <Textarea value={unexpected} onChange={(e) => setUnexpected(e.target.value)} />
          </Field>
        </>
      )}

      {page === 3 && (
        <>
          <Field label="What would you do differently?">
            <Textarea value={differently} onChange={(e) => setDifferently(e.target.value)} />
          </Field>
          <Field label="What did you learn?">
            <Textarea value={lessons} onChange={(e) => setLessons(e.target.value)} />
          </Field>
          <Field label="Process quality (optional): given what you knew then…">
            {Object.entries(PROCESS).map(([k, t]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!process[k]} onChange={(e) => setProcess({ ...process, [k]: e.target.checked })} /> {t}
              </label>
            ))}
          </Field>
        </>
      )}

      {err && <Notice tone="error">{err}</Notice>}
      <div className="flex justify-between">
        <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
          ← Back
        </Button>
        {page < 3 ? (
          <Button disabled={page === 1 && !what.trim()} onClick={() => setPage(page + 1)}>
            Next →
          </Button>
        ) : (
          <Button disabled={saving} onClick={() => void submit()}>
            {saving && <Spinner />} Save review
          </Button>
        )}
      </div>
    </Card>
  );
}
