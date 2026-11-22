/** Request-body validation for API routes. Never trust the client. */
import { z } from "zod";
import { isAllowedReferenceUrl } from "./web/wikipedia";
import {
  ALTERNATIVE_TAGS,
  CATEGORIES,
  COMPANY_STAGES,
  CONSTRAINT_TAGS,
  CUSTOMER_SEGMENTS,
  DECISION_TYPES,
  OUTCOME_STATUSES,
  PRIVACY_MODES,
  TIME_HORIZONS,
} from "./vocab";

const origin = z.enum(["ai_extracted", "user_confirmed", "user_added"]);
const short = (n = 300) => z.string().trim().max(n);

export const FacetsZ = z.object({
  customer_segment: z.enum(CUSTOMER_SEGMENTS).optional(),
  company_stage: z.enum(COMPANY_STAGES).optional(),
});

export const MatchRequestZ = z.object({
  category: z.enum(CATEGORIES),
  decision_type: z.enum(DECISION_TYPES),
  title: short(160),
  context: short(2000),
  objective: short(600),
  alternative_tags: z.array(z.enum(ALTERNATIVE_TAGS)).max(10),
  constraint_tags: z.array(z.enum(CONSTRAINT_TAGS)).max(10),
  facets: FacetsZ,
});
export type MatchRequest = z.infer<typeof MatchRequestZ>;

export const CreateDecisionZ = z.object({
  title: short(160).min(1),
  category: z.enum(CATEGORIES),
  decision_type: z.enum(DECISION_TYPES),
  context: short(4000),
  objective: short(600),
  time_horizon: z.enum(TIME_HORIZONS),
  facets: FacetsZ,
  constraints: z.array(z.enum(CONSTRAINT_TAGS)).max(10),
  expected_benefits: z.array(short()).max(10),
  risks: z.array(short()).max(10),
  alternatives: z
    .array(z.object({ label: short(120).min(1), description: short(400), tag: z.enum(ALTERNATIVE_TAGS), origin }))
    .min(1)
    .max(8),
  assumptions: z.array(z.object({ text: short().min(1), origin })).max(12),
  chosen_index: z.number().int().min(0).nullable(),
  reasons: short(4000),
  expected_outcome: short(2000),
  success_criteria: z.array(z.object({ metric: short(200).min(1), target: short(200), by: short(10) })).max(8),
  decided_at: z.string().datetime().nullable(),
  review_due_at: z.string().datetime().nullable(),
  field_origins: z.record(z.string(), origin),
});
export type CreateDecision = z.infer<typeof CreateDecisionZ>;

export const ReviewZ = z.object({
  what_happened: short(4000).min(1),
  unexpected_events: short(2000),
  would_do_differently: short(2000),
  lessons: short(2000),
  outcome_status: z.enum(OUTCOME_STATUSES),
  process_checklist: z.record(z.string(), z.boolean()),
  assumption_results: z.array(
    z.object({ id: z.string().uuid(), result: z.enum(["held", "failed", "unclear"]), note: short(500) }),
  ),
  criteria_results: z.array(z.object({ metric: short(200), result: z.enum(["met", "partly", "not_met", "unknown"]) })),
  evidence_links: z.array(z.string().url()).max(10),
});
export type ReviewInput = z.infer<typeof ReviewZ>;

export const PrivacyModeZ = z.object({ privacy_mode: z.enum(PRIVACY_MODES) });

export const ConsentZ = z.object({
  purpose: short(300).min(1),
  payload_text: z.string().min(10).max(2000),
  keep_copy: z.boolean(),
  save_results: z.boolean(),
  model: short(80),
});

export const ResearchSaveZ = z.object({
  consent_id: z.string().uuid(),
  payload_text: z.string().min(10).max(2000),
  decision_id: z.string().uuid().nullable(),
  result_text: z.string().max(40000),
  web_search_queries: z.array(z.string().max(500)).max(30),
  search_entry_point_html: z.string().max(200000).nullable(),
  sources: z.array(z.object({ uri: z.string().url(), title: z.string().max(500).nullable(), domain: z.string().max(300).nullable() })).max(50),
  findings: z.array(z.object({ text: z.string().max(4000), chunk_indices: z.array(z.number().int().min(0)).max(50) })).max(100),
});

export const AiLogZ = z.object({
  task: z.enum(["extract", "generalize", "summarize", "research"]),
  inferenceSource: z.enum(["ON_DEVICE", "IN_CLOUD"]).nullable(),
  success: z.boolean(),
  errorCode: z.string().max(80).optional(),
  latencyMs: z.number().int().min(0).max(600000),
});

export const WebSearchQueryZ = z.string().trim().min(2).max(120);

export const WebReferenceZ = z.object({
  url: z.string().url().max(500).refine(isAllowedReferenceUrl, "Only Wikipedia links can be saved"),
  title: short(300).min(1),
  snippet: short(1200),
  publisher: short(80).min(1),
  query: short(120),
});

export const WebReferenceDeleteZ = z.object({ id: z.string().uuid() });
