"use client";
/** Step 2: the user reviews, corrects and approves the AI-extracted structure. */
import type { FieldOrigin, StructuredDecision } from "@/lib/types";
import {
  ALTERNATIVE_TAGS,
  CATEGORIES,
  COMPANY_STAGES,
  CONSTRAINT_TAGS,
  CUSTOMER_SEGMENTS,
  DECISION_TYPES,
  TIME_HORIZONS,
  label,
  type AlternativeTag,
  type CompanyStage,
} from "@/lib/vocab";
import { OriginChip } from "./marks";
import { Button, Card, CardTitle, Field, Input, Select, Textarea } from "./ui";
import { useLanguage } from "@/lib/i18n";

type Key = keyof StructuredDecision;

export function emptyDecision(context = ""): StructuredDecision {
  return {
    title: "",
    category: "other",
    decision_type: "choose_one",
    context,
    objective: "",
    time_horizon: "months",
    alternatives: [
      { label: "", description: "", tag: "other", origin: "user_added" },
      { label: "", description: "", tag: "other", origin: "user_added" },
    ],
    constraints: [],
    assumptions: [],
    expected_benefits: [],
    risks: [],
    missing_information: [],
    facets: { customer_segment: "unknown", company_stage: "unknown" },
    field_origins: {},
  };
}

export function StructureEditor({
  value,
  onChange,
  onApprove,
}: {
  value: StructuredDecision;
  onChange: (d: StructuredDecision) => void;
  onApprove: () => void;
}) {
  const { t } = useLanguage();
  const d = value;
  const origin = (k: string): FieldOrigin | undefined => d.field_origins[k];
  const set = <K extends Key>(k: K, v: StructuredDecision[K]) =>
    onChange({ ...d, [k]: v, field_origins: { ...d.field_origins, [k]: d.field_origins[k] === "ai_extracted" ? "user_confirmed" : d.field_origins[k] ?? "user_added" } });

  const listEditor = (k: "assumptions" | "expected_benefits" | "risks", title: string, hint?: string) => {
    const items = k === "assumptions" ? d.assumptions.map((a) => a.text) : d[k];
    const update = (next: string[]) => {
      if (k === "assumptions") {
        onChange({
          ...d,
          assumptions: next.map((t, i) => ({ text: t, origin: d.assumptions[i]?.text === t ? d.assumptions[i].origin : d.assumptions[i] ? "user_confirmed" : "user_added" })),
        });
      } else set(k, next);
    };
    return (
      <Field label={title} aside={k !== "assumptions" ? <OriginChip origin={origin(k)} /> : undefined}>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
        <ul className="space-y-1.5">
          {items.map((text, i) => (
            <li key={i} className="flex items-center gap-2">
              {k === "assumptions" && <OriginChip origin={d.assumptions[i]?.origin} />}
              {k === "assumptions" && <span className="text-xs text-amber-700">{t("unverified")}</span>}
              <Input value={text} onChange={(e) => update(items.map((x, j) => (j === i ? e.target.value : x)))} />
              <Button variant="ghost" type="button" aria-label={t("Remove")} onClick={() => update(items.filter((_, j) => j !== i))}>
                ✕
              </Button>
            </li>
          ))}
        </ul>
        <Button variant="ghost" type="button" onClick={() => update([...items, ""])}>
          + Add
        </Button>
      </Field>
    );
  };

  const valid = d.title.trim() && d.alternatives.filter((a) => a.label.trim()).length >= 1;

  return (
    <Card className="space-y-5">
      <CardTitle hint="AI suggestions are unverified until you confirm them">Review the structure</CardTitle>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title" aside={<OriginChip origin={origin("title")} />}>
          <Input value={d.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Objective" aside={<OriginChip origin={origin("objective")} />}>
          <Input value={d.objective} onChange={(e) => set("objective", e.target.value)} />
        </Field>
        <Field label="Category" aside={<OriginChip origin={origin("category")} />}>
          <Select options={CATEGORIES} labels={label} value={d.category} onChange={(e) => set("category", e.target.value as StructuredDecision["category"])} />
        </Field>
        <Field label="Decision type" aside={<OriginChip origin={origin("decision_type")} />}>
          <Select options={DECISION_TYPES} labels={label} value={d.decision_type} onChange={(e) => set("decision_type", e.target.value as StructuredDecision["decision_type"])} />
        </Field>
        <Field label="Customer segment" aside={<OriginChip origin={origin("facets")} />}>
          <Select options={CUSTOMER_SEGMENTS} labels={label} value={d.facets.customer_segment ?? "unknown"} onChange={(e) => set("facets", { ...d.facets, customer_segment: e.target.value as "b2b" })} />
        </Field>
        <Field label="Company / project stage">
          <Select options={COMPANY_STAGES} labels={label} value={d.facets.company_stage ?? "unknown"} onChange={(e) => set("facets", { ...d.facets, company_stage: e.target.value as CompanyStage })} />
        </Field>
        <Field label="Time horizon" aside={<OriginChip origin={origin("time_horizon")} />}>
          <Select options={TIME_HORIZONS} labels={label} value={d.time_horizon} onChange={(e) => set("time_horizon", e.target.value as StructuredDecision["time_horizon"])} />
        </Field>
      </div>

      <Field label="Context" aside={<OriginChip origin={origin("context")} />}>
        <Textarea value={d.context} onChange={(e) => set("context", e.target.value)} />
      </Field>

      <Field label="Alternatives" aside={<OriginChip origin={origin("alternatives")} />}>
        <div className="space-y-2">
          {d.alternatives.map((a, i) => (
            <div key={i} className="grid gap-2 rounded-md border border-slate-200 p-2 md:grid-cols-[1fr_1.5fr_12rem_auto]">
              <Input placeholder="Option" value={a.label} onChange={(e) => set("alternatives", d.alternatives.map((x, j) => (j === i ? { ...x, label: e.target.value, origin: x.origin === "ai_extracted" ? "user_confirmed" : x.origin } : x)))} />
              <Input placeholder="Short description" value={a.description} onChange={(e) => set("alternatives", d.alternatives.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              <Select options={ALTERNATIVE_TAGS} labels={label} value={a.tag} aria-label={t("Option type (used for matching)")} onChange={(e) => set("alternatives", d.alternatives.map((x, j) => (j === i ? { ...x, tag: e.target.value as AlternativeTag } : x)))} />
              <Button variant="ghost" type="button" aria-label={t("Remove option")} onClick={() => set("alternatives", d.alternatives.filter((_, j) => j !== i))}>
                ✕
              </Button>
            </div>
          ))}
          <Button variant="ghost" type="button" onClick={() => set("alternatives", [...d.alternatives, { label: "", description: "", tag: "other", origin: "user_added" }])}>
            + Add option
          </Button>
        </div>
      </Field>

      <Field label="Constraints" aside={<OriginChip origin={origin("constraints")} />}>
        <div className="flex flex-wrap gap-3">
          {CONSTRAINT_TAGS.map((c) => (
            <label key={c} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={d.constraints.includes(c)}
                onChange={(e) => set("constraints", e.target.checked ? [...d.constraints, c] : d.constraints.filter((x) => x !== c))}
              />
              {label(c)}
            </label>
          ))}
        </div>
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        {listEditor("assumptions", "Assumptions", "Beliefs this decision depends on. You'll check each one at review time.")}
        {listEditor("risks", "Risks")}
        {listEditor("expected_benefits", "Expected benefits")}
        {d.missing_information.length > 0 && (
          <Field label="Missing information" aside={<OriginChip origin="ai_extracted" />}>
            <ul className="list-inside list-disc text-sm text-slate-700">
              {d.missing_information.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            <p className="text-xs text-slate-500">{t("Consider adding these to the context.")}</p>
          </Field>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={onApprove} disabled={!valid}>
          Approve structure &amp; find precedent →
        </Button>
      </div>
    </Card>
  );
}
