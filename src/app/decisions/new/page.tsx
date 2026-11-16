"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { InferenceBadge } from "@/components/marks";
import { MatchCard } from "@/components/MatchCard";
import { ResearchPanel } from "@/components/ResearchPanel";
import { emptyDecision, StructureEditor } from "@/components/StructureEditor";
import { Button, Card, CardTitle, Field, Input, Notice, Spinner, Textarea, cn } from "@/components/ui";
import { extractDecision, prepareDeviceModel, type Where } from "@/lib/ai/tasks";
import { RoutingError } from "@/lib/ai/router";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import type { MatchResult, StructuredDecision, SuccessCriterion, Sufficiency } from "@/lib/types";

type Step = "describe" | "structure" | "evidence" | "record";

export default function NewDecisionPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <NewDecision />
    </Suspense>
  );
}

function NewDecision() {
  const { me, aiStatus, refreshAiStatus } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const past = useSearchParams().get("past") === "1";
  const [step, setStep] = useState<Step>("describe");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "warn" | "error" | "info"; msg: string } | null>(null);
  const [where, setWhere] = useState<Where | null>(null);
  const [d, setD] = useState<StructuredDecision>(emptyDecision());
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [sufficiency, setSufficiency] = useState<Sufficiency>("insufficient");
  const [tab, setTab] = useState<"personal" | "external">("personal");

  if (!me) return null;

  async function structure() {
    setNotice(null);
    setBusy(t("Preparing private AI…"));
    try {
      if (aiStatus === "downloadable" || aiStatus === "downloading") {
        // This click is the user gesture Chrome requires before downloading Gemini Nano.
        await prepareDeviceModel((p) => setBusy(`${t("Downloading private AI model…")} ${Math.round(p * 100)}%`));
        await refreshAiStatus();
      }
      setBusy(t("Structuring your decision…"));
      const r = await extractDecision(text, me!.privacyMode);
      const e = r.data;
      setD({
        title: e.title,
        category: e.category,
        decision_type: e.decision_type,
        context: e.context || text,
        objective: e.objective,
        time_horizon: e.time_horizon,
        alternatives: e.alternatives.map((a) => ({ ...a, origin: "ai_extracted" })),
        constraints: e.constraints,
        assumptions: e.assumptions.map((t) => ({ text: t, origin: "ai_extracted" })),
        expected_benefits: e.expected_benefits,
        risks: e.risks,
        missing_information: e.missing_information,
        facets: { customer_segment: e.customer_segment, company_stage: e.company_stage },
        field_origins: Object.fromEntries(
          ["title", "category", "decision_type", "context", "objective", "time_horizon", "alternatives", "constraints", "expected_benefits", "risks", "facets"].map((k) => [k, "ai_extracted"]),
        ),
      });
      setWhere(r.where);
      setStep("structure");
    } catch (e) {
      const msg =
        e instanceof RoutingError
          ? e.message
          : me!.privacyMode === "private"
            ? "Private AI isn't available on this device, and Private mode never uses the cloud. Fill in the structure yourself below, or enable Hybrid mode in Settings."
            : `AI structuring failed (${e instanceof Error ? e.message : String(e)}). Fill in the structure yourself below.`;
      setNotice({ tone: "warn", msg });
      manual();
    } finally {
      setBusy(null);
    }
  }

  function manual() {
    setD(emptyDecision(text));
    setWhere(null);
    setStep("structure");
  }

  async function findPrecedent() {
    setBusy("Searching your history and curated cases…");
    setNotice(null);
    try {
      const r = await api<{ matches: MatchResult[]; sufficiency: Sufficiency }>("/api/match", {
        method: "POST",
        body: {
          category: d.category,
          decision_type: d.decision_type,
          title: d.title,
          context: d.context,
          objective: d.objective,
          alternative_tags: d.alternatives.map((a) => a.tag),
          constraint_tags: d.constraints,
          facets: d.facets,
        },
      });
      setMatches(r.matches);
      setSufficiency(r.sufficiency);
      setTab(r.matches.some((m) => m.targetType === "personal_decision") ? "personal" : "external");
      setStep("evidence");
    } catch (e) {
      setNotice({ tone: "error", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  const personal = matches.filter((m) => m.targetType === "personal_decision");
  const external = matches.filter((m) => m.targetType === "external_case");

  return (
    <>
      <PageTitle title={past ? "Log a past decision" : "New decision"} subtitle="DecisionTrail shows precedent. It never decides for you or predicts your outcome." />
      <ol className="flex gap-2 text-sm">
        {(["describe", "structure", "evidence", "record"] as Step[]).map((s, i) => (
          <li key={s} className={cn("rounded-full px-3 py-1", step === s ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-600")}>
            {i + 1}. {t(s[0].toUpperCase() + s.slice(1))}
          </li>
        ))}
      </ol>
      {notice && <Notice tone={notice.tone}>{notice.msg}</Notice>}

      {step === "describe" && (
        <Card className="space-y-4">
          <CardTitle hint="English works best on-device">Describe the decision in your own words</CardTitle>
          <Textarea
            className="min-h-44"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. I'm developing a B2B SaaS for small clinics. I'm considering whether to offer a free plan, a paid subscription with a trial, or a one-time license. Budget is limited and I'm the only developer."
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void structure()} disabled={!!busy || text.trim().length < 20}>
                {busy ? <Spinner /> : "🔒"} {t("Structure with private AI")}
            </Button>
            <Button variant="secondary" onClick={manual} disabled={!!busy}>
              Fill in manually
            </Button>
            {busy && <span className="text-sm text-slate-600">{busy}</span>}
          </div>
          <p className="text-xs text-slate-500">
            {me.privacyMode === "private"
              ? t("Private mode: structuring runs only on this device. If on-device AI is unavailable, you'll fill in the form yourself.")
              : t("Hybrid mode: on-device first; if that isn't possible, your text is sent to cloud Gemini, and the result is marked ☁️ IN_CLOUD.")}
          </p>
        </Card>
      )}

      {step === "structure" && (
        <>
          {where && (
            <Notice tone="info">
              {t("Structured by AI")} <InferenceBadge where={where} />. {t("Review every field. Assumptions are unverified until you check them.")}
            </Notice>
          )}
          <StructureEditor value={d} onChange={setD} onApprove={() => void findPrecedent()} />
          {busy && (
            <p className="text-sm text-slate-600">
              <Spinner /> {busy}
            </p>
          )}
        </>
      )}

      {step === "evidence" && (
        <>
          <SufficiencyBanner s={sufficiency} personal={personal.length} external={external.length} />
          <div className="flex gap-2" role="tablist">
            <TabBtn active={tab === "personal"} onClick={() => setTab("personal")}>
              {t("Your past decisions")} ({personal.length})
            </TabBtn>
            <TabBtn active={tab === "external"} onClick={() => setTab("external")}>
              {t("Historical cases")} ({external.length})
            </TabBtn>
          </div>
          <div className="space-y-3">
            {(tab === "personal" ? personal : external).map((m) => (
              <MatchCard key={m.targetType + m.targetId} m={m} current={{ title: d.title, context: d.context }} />
            ))}
            {(tab === "personal" ? personal : external).length === 0 && (
              <p className="text-sm text-slate-500">
                {t(tab === "personal" ? "None of your recorded decisions is comparable yet." : "No curated case is comparable enough to show.")}
              </p>
            )}
          </div>
          <ResearchPanel decision={d} privateText={text} privacyMode={me.privacyMode} prominent={sufficiency !== "sufficient"} />
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep("structure")}>
              ← Edit structure
            </Button>
            <Button onClick={() => setStep("record")}>Record my decision →</Button>
          </div>
        </>
      )}

      {step === "record" && <RecordStep d={d} past={past} matchesShown={matches.length} onSaved={(id) => router.push(`/decisions/${id}`)} />}
    </>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <button role="tab" aria-selected={active} onClick={onClick} className={cn("rounded-md px-3 py-1.5 text-sm", active ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-300")}>
      {typeof children === "string" ? t(children) : children}
    </button>
  );
}

function SufficiencyBanner({ s, personal, external }: { s: Sufficiency; personal: number; external: number }) {
  const { t } = useLanguage();
  if (s === "sufficient") return <Notice tone="ok">{t("Relevant precedent found:")} {personal} {t("of your decisions and")} {external} {t("curated cases. Compare them below.")}</Notice>;
  if (s === "partial")
    return <Notice tone="warn">{t("Some related precedent was found, but with important differences or unknown outcomes. Treat it with care. Web research is optional.")}</Notice>;
  return (
    <Notice tone="warn">
      <strong>{t("We couldn't find sufficiently relevant historical cases for your decision.")}</strong> {t("Why: fewer than one strong match with a known outcome and fewer than two partial matches")}
      ({personal} {t("personal")}, {external} {t("curated shown")}). {t("You can research it on the web below, edit the structure to broaden it, or continue without research.")}
    </Notice>
  );
}

function addDays(n: number) {
  const x = new Date();
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
}

function RecordStep({ d, past, matchesShown, onSaved }: { d: StructuredDecision; past: boolean; matchesShown: number; onSaved: (id: string) => void }) {
  const { t } = useLanguage();
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
      <CardTitle hint={`${matchesShown} ${t("matches will be saved with this record")}`}>Record your decision</CardTitle>
      <Field label="Your choice">
        <div className="space-y-1">
          {options.map((o, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <input type="radio" name="chosen" checked={chosen === i} onChange={() => setChosen(i)} />
              <span className="font-medium">{o.label}</span> <span className="text-slate-500">{o.description}</span>
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="radio" name="chosen" checked={chosen === null} onChange={() => setChosen(null)} /> Not decided yet (save as draft)
          </label>
        </div>
      </Field>
      <Field label="Why (your original reasoning, preserved as written)">
        <Textarea value={reasons} onChange={(e) => setReasons(e.target.value)} />
      </Field>
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
                ✕
              </Button>
            </div>
          ))}
          <Button variant="ghost" onClick={() => setCriteria([...criteria, { metric: "", target: "", by: addDays(90) }])}>
            + Add criterion
          </Button>
        </div>
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        {past && (
          <Field label="When did you decide?">
            <Input type="date" value={decidedAt} onChange={(e) => setDecidedAt(e.target.value)} />
          </Field>
        )}
        <Field label="Review date">
          <div className="flex gap-2">
            <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
            {[14, 30, 90].map((n) => (
              <Button key={n} variant="secondary" onClick={() => setReviewDate(addDays(n))}>
                {n}d
              </Button>
            ))}
          </div>
          {past && <p className="text-xs text-slate-500">Logging a past decision? Set the review date to today and record the outcome on the next screen.</p>}
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
