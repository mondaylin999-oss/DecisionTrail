/**
 * Controlled vocabularies. Matching is deterministic and only works when both
 * sides use the same tags, so AI extraction is constrained to these enums and
 * the user confirms them.
 */

export const CATEGORIES = [
  "pricing",
  "product",
  "technology",
  "growth",
  "business_strategy",
  "hiring",
  "operations",
  "career",
  "education",
  "personal",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Categories that are close enough to be compared with each other. */
export const RELATED_CATEGORIES: Partial<Record<Category, Category[]>> = {
  pricing: ["business_strategy", "growth", "product"],
  product: ["pricing", "business_strategy"],
  growth: ["pricing", "business_strategy"],
  business_strategy: ["pricing", "product", "growth", "operations"],
  technology: ["operations"],
  operations: ["technology", "business_strategy"],
};

export const DECISION_TYPES = [
  "choose_one",
  "yes_no",
  "allocate",
  "timing",
  "stop_continue",
] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

export const TIME_HORIZONS = ["days", "weeks", "months", "years"] as const;
export type TimeHorizon = (typeof TIME_HORIZONS)[number];

export const ALTERNATIVE_TAGS = [
  "free_plan",
  "freemium",
  "free_trial",
  "paid_subscription",
  "one_time_purchase",
  "usage_based",
  "open_source",
  "price_increase",
  "price_decrease",
  "relational_db",
  "document_db",
  "managed_service",
  "self_hosted",
  "cloud",
  "monolith",
  "microservices",
  "serverless",
  "build",
  "buy",
  "outsource",
  "hire",
  "launch_now",
  "delay",
  "stop",
  "continue",
  "other",
] as const;
export type AlternativeTag = (typeof ALTERNATIVE_TAGS)[number];

export const CONSTRAINT_TAGS = [
  "budget_limited",
  "small_team",
  "time_pressure",
  "regulated",
  "technical_debt",
  "limited_audience",
  "existing_customers",
] as const;
export type ConstraintTag = (typeof CONSTRAINT_TAGS)[number];

export const CUSTOMER_SEGMENTS = ["b2b", "b2c", "both", "unknown"] as const;
export const COMPANY_STAGES = [
  "idea",
  "pre_revenue",
  "early",
  "growth",
  "enterprise",
  "unknown",
] as const;
export type CompanyStage = (typeof COMPANY_STAGES)[number];

export const OUTCOME_CATEGORIES = [
  "positive",
  "negative",
  "mixed",
  "reversed",
  "inconclusive",
  "unknown",
] as const;
export type OutcomeCategory = (typeof OUTCOME_CATEGORIES)[number];

export const OUTCOME_STATUSES = [
  "pending",
  "achieved",
  "partially_achieved",
  "not_achieved",
  "inconclusive",
] as const;
export type OutcomeStatus = (typeof OUTCOME_STATUSES)[number];

export const PRIVACY_MODES = ["private", "hybrid", "cloud_research"] as const;
export type PrivacyMode = (typeof PRIVACY_MODES)[number];

export function label(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
