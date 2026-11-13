/**
 * Deterministic matching (spec J). Pure functions: no I/O, no AI.
 * The AI may later rephrase the explanation lists, but it never decides
 * which cases match or how strongly.
 */
import type { MatchExplanation, MatchLabel, Sufficiency } from "../types";
import {
  COMPANY_STAGES,
  RELATED_CATEGORIES,
  label as humanize,
  type Category,
  type CompanyStage,
} from "../vocab";

export const ALGORITHM_VERSION = "rules-v1";

export interface MatchAttributes {
  category: Category;
  decisionType: string;
  alternativeTags: string[];
  constraintTags: string[];
  facets: { customer_segment?: string; company_stage?: CompanyStage };
  /** Year the decision was made (for the era-gap penalty on technology). */
  year?: number;
}

export interface Candidate extends MatchAttributes {
  /** PostgreSQL ts_rank_cd normalised to 0..1 (computed in SQL). */
  textRank: number;
}

export interface ScoreBreakdown {
  score: number;
  label: MatchLabel | null;
  reasons: string[];
  explanation: MatchExplanation;
}

export const WEIGHTS = {
  decisionType: 25,
  alternatives: 25,
  text: 20,
  facets: 20,
  constraints: 10,
  scalePenalty: 15,
  eraPenalty: 10,
} as const;

export const THRESHOLDS = { strong: 65, partial: 40, weak: 25 } as const;

export function jaccard(a: string[], b: string[]): number {
  const A = new Set(a.filter((t) => t !== "other"));
  const B = new Set(b.filter((t) => t !== "other"));
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

export function intersection(a: string[], b: string[]): string[] {
  const B = new Set(b);
  return [...new Set(a)].filter((t) => B.has(t) && t !== "other");
}

export function categoriesComparable(a: Category, b: Category): boolean {
  return a === b || (RELATED_CATEGORIES[a] ?? []).includes(b);
}

function stageIndex(stage?: CompanyStage): number | null {
  if (!stage || stage === "unknown") return null;
  return COMPANY_STAGES.indexOf(stage);
}

export function scoreCandidate(query: MatchAttributes, c: Candidate): ScoreBreakdown {
  const similarities: string[] = [];
  const differences: string[] = [];
  const unknowns: string[] = [];
  let score = 0;

  // Decision type
  const sameType = query.decisionType === c.decisionType;
  if (sameType) {
    score += WEIGHTS.decisionType;
    similarities.push(`Same kind of decision (${humanize(c.decisionType)})`);
  } else {
    differences.push(
      `Different kind of decision: yours is ${humanize(query.decisionType)}, theirs was ${humanize(c.decisionType)}`,
    );
  }

  // Alternatives
  const sharedAlts = intersection(query.alternativeTags, c.alternativeTags);
  score += WEIGHTS.alternatives * jaccard(query.alternativeTags, c.alternativeTags);
  if (sharedAlts.length > 0) {
    similarities.push(`Shared options: ${sharedAlts.map(humanize).join(", ")}`);
  } else if (c.alternativeTags.length === 0) {
    unknowns.push("Alternatives they considered are not documented");
  } else {
    differences.push("None of the options considered overlap with yours");
  }

  // Text relevance (FTS)
  const text = Math.max(0, Math.min(1, c.textRank));
  score += WEIGHTS.text * text;
  if (text >= 0.3) similarities.push("Similar objective and context wording");

  // Facets
  const keys = ["customer_segment", "company_stage"] as const;
  let known = 0;
  let equal = 0;
  for (const k of keys) {
    const q = query.facets[k];
    const v = c.facets[k];
    if (!q || q === "unknown" || !v || v === "unknown") {
      unknowns.push(`${humanize(k)}: not known on both sides`);
      continue;
    }
    known++;
    if (q === v) {
      equal++;
      similarities.push(`Same ${humanize(k).toLowerCase()} (${humanize(v)})`);
    } else {
      differences.push(
        `${humanize(k)}: yours ${humanize(q)}, theirs ${humanize(v)}`,
      );
    }
  }
  if (known > 0) score += WEIGHTS.facets * (equal / known);

  // Constraints
  const sharedCons = intersection(query.constraintTags, c.constraintTags);
  score += WEIGHTS.constraints * jaccard(query.constraintTags, c.constraintTags);
  if (sharedCons.length > 0) {
    similarities.push(`Shared constraints: ${sharedCons.map(humanize).join(", ")}`);
  }

  // Penalties
  let penalised = false;
  const qs = stageIndex(query.facets.company_stage);
  const cs = stageIndex(c.facets.company_stage);
  if (qs !== null && cs !== null && Math.abs(qs - cs) >= 2) {
    score -= WEIGHTS.scalePenalty;
    penalised = true;
    differences.push("Very different company scale. Lessons may not transfer directly");
  }
  if (
    c.category === "technology" &&
    query.year &&
    c.year &&
    Math.abs(query.year - c.year) > 15
  ) {
    score -= WEIGHTS.eraPenalty;
    penalised = true;
    differences.push(`More than 15 years apart (${c.year}); technology has changed`);
  }

  score = Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;

  let lbl: MatchLabel | null = null;
  const strongCriteria =
    score >= THRESHOLDS.strong && sameType && sharedAlts.length >= 1 && !penalised;
  if (strongCriteria) lbl = "strong";
  else if (score >= THRESHOLDS.partial || (score >= THRESHOLDS.strong && penalised)) lbl = "partial";
  else if (score >= THRESHOLDS.weak) lbl = "weak";

  const reasons = buildReasons(lbl, { sameType, sharedAlts, penalised, score });

  return { score, label: lbl, reasons, explanation: { similarities, differences, unknowns } };
}

function buildReasons(
  lbl: MatchLabel | null,
  x: { sameType: boolean; sharedAlts: string[]; penalised: boolean; score: number },
): string[] {
  const r: string[] = [];
  if (lbl === "strong") {
    r.push("Same decision type, at least one shared option, and comparable context");
  } else if (lbl === "partial") {
    if (x.penalised) r.push("Related, but scale or era differs a lot");
    if (!x.sameType) r.push("Related topic, but a different kind of decision");
    if (x.sharedAlts.length === 0) r.push("No shared options");
    if (r.length === 0) r.push("Related, with important contextual differences");
  } else if (lbl === "weak") {
    r.push("Only loosely related");
  }
  return r;
}

/** Spec H: decide whether to offer live research. */
export function assessSufficiency(
  matches: { label: MatchLabel; outcomeKnown: boolean }[],
): Sufficiency {
  const strong = matches.filter((m) => m.label === "strong" && m.outcomeKnown).length;
  const partial = matches.filter((m) => m.label === "partial").length;
  if (strong >= 2) return "sufficient";
  if (strong === 1 || partial >= 2) return "partial";
  return "insufficient";
}

/**
 * Build a safe OR-query for PostgreSQL to_tsquery from free text.
 * Only [a-z0-9] tokens of length >= 3 survive, so user input cannot inject
 * tsquery operators.
 */
const STOP = new Set([
  "the", "and", "for", "with", "should", "would", "could", "our", "your", "you",
  "are", "was", "this", "that", "from", "into", "about", "whether", "what", "which",
  "have", "has", "had", "not", "but", "can", "will", "use", "using", "want", "need",
]);

export function toOrTsQuery(text: string, max = 24): string | null {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
  const uniq = [...new Set(tokens)].slice(0, max);
  return uniq.length ? uniq.join(" | ") : null;
}
