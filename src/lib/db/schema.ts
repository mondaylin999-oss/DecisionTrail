/**
 * Drizzle schema: the MVP subset of spec M.
 * Personal tables always carry user_id; every query in repo.ts filters on it.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  CATEGORIES,
  DECISION_TYPES,
  OUTCOME_CATEGORIES,
  OUTCOME_STATUSES,
  PRIVACY_MODES,
  TIME_HORIZONS,
} from "../vocab";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const privacyModeEnum = pgEnum("privacy_mode", PRIVACY_MODES);
export const categoryEnum = pgEnum("decision_category", CATEGORIES);
export const decisionTypeEnum = pgEnum("decision_type", DECISION_TYPES);
export const timeHorizonEnum = pgEnum("time_horizon", TIME_HORIZONS);
export const decisionStatusEnum = pgEnum("decision_status", [
  "draft",
  "decided",
  "awaiting_review",
  "reviewed",
  "archived",
]);
export const originEnum = pgEnum("field_origin", ["ai_extracted", "user_confirmed", "user_added"]);
export const assumptionResultEnum = pgEnum("assumption_result", ["held", "failed", "unclear"]);
export const outcomeStatusEnum = pgEnum("outcome_status", OUTCOME_STATUSES);
export const outcomeCategoryEnum = pgEnum("outcome_category", OUTCOME_CATEGORIES);
export const provenanceEnum = pgEnum("provenance_class", [
  "primary",
  "corroborated",
  "independent_reporting",
  "self_reported",
  "unverified",
]);
export const sourceTypeEnum = pgEnum("source_type", [
  "primary",
  "filing",
  "academic",
  "news",
  "case_study",
  "interview",
  "postmortem",
  "documentation",
  "other",
]);
export const claimTypeEnum = pgEnum("claim_type", ["context", "decision", "reason", "action", "outcome", "lesson"]);
export const supportEnum = pgEnum("claim_support", ["supports", "contradicts", "partial"]);
export const matchLabelEnum = pgEnum("match_label", ["strong", "partial", "weak"]);
export const inferenceSourceEnum = pgEnum("inference_source", ["ON_DEVICE", "IN_CLOUD"]);
export const researchStatusEnum = pgEnum("research_status", ["completed", "insufficient", "failed"]);

// ───────────────────────── Personal decision domain ─────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Firebase uid
  email: text("email"),
  displayName: text("display_name"),
  privacyMode: privacyModeEnum("privacy_mode").notNull().default("private"),
  createdAt: createdAt(),
});

export const decisionRecords = pgTable(
  "decision_records",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    category: categoryEnum("category").notNull(),
    decisionType: decisionTypeEnum("decision_type").notNull(),
    context: text("context").notNull().default(""),
    objective: text("objective").notNull().default(""),
    timeHorizon: timeHorizonEnum("time_horizon").notNull().default("months"),
    domainFacets: jsonb("domain_facets").$type<Record<string, string>>().notNull().default({}),
    constraintTags: text("constraint_tags").array().notNull().default(sql`'{}'::text[]`),
    expectedBenefits: text("expected_benefits").array().notNull().default(sql`'{}'::text[]`),
    risks: text("risks").array().notNull().default(sql`'{}'::text[]`),
    status: decisionStatusEnum("status").notNull().default("draft"),
    chosenOptionId: uuid("chosen_option_id"),
    reasons: text("reasons").notNull().default(""),
    expectedOutcome: text("expected_outcome").notNull().default(""),
    successCriteria: jsonb("success_criteria").$type<{ metric: string; target: string; by: string }[]>().notNull().default([]),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    reviewDueAt: timestamp("review_due_at", { withTimezone: true }),
    fieldOrigins: jsonb("field_origins").$type<Record<string, string>>().notNull().default({}),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("decision_records_user_status_idx").on(t.userId, t.status),
    index("decision_records_user_review_idx").on(t.userId, t.reviewDueAt),
    index("decision_records_fts_idx").using(
      "gin",
      sql`to_tsvector('english', ${t.title} || ' ' || ${t.context} || ' ' || ${t.objective})`,
    ),
  ],
);

export const decisionOptions = pgTable(
  "decision_options",
  {
    id: id(),
    decisionId: uuid("decision_id").notNull().references(() => decisionRecords.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    description: text("description").notNull().default(""),
    alternativeTag: text("alternative_tag").notNull().default("other"),
    origin: originEnum("origin").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("decision_options_decision_idx").on(t.decisionId)],
);

export const decisionAssumptions = pgTable(
  "decision_assumptions",
  {
    id: id(),
    decisionId: uuid("decision_id").notNull().references(() => decisionRecords.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    origin: originEnum("origin").notNull(),
    reviewResult: assumptionResultEnum("review_result"),
    reviewNote: text("review_note"),
  },
  (t) => [index("decision_assumptions_decision_idx").on(t.decisionId)],
);

/** Append-only snapshots. v1 is frozen at decision time and used for reviews. */
export const decisionVersions = pgTable(
  "decision_versions",
  {
    id: id(),
    decisionId: uuid("decision_id").notNull().references(() => decisionRecords.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    changeReason: text("change_reason").notNull().default("initial decision"),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("decision_versions_unique").on(t.decisionId, t.versionNo)],
);

export const decisionReviews = pgTable("decision_reviews", {
  id: id(),
  decisionId: uuid("decision_id").notNull().references(() => decisionRecords.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
  whatHappened: text("what_happened").notNull(),
  unexpectedEvents: text("unexpected_events").notNull().default(""),
  wouldDoDifferently: text("would_do_differently").notNull().default(""),
  lessons: text("lessons").notNull().default(""),
  processChecklist: jsonb("process_checklist").$type<Record<string, boolean>>().notNull().default({}),
  evidenceLinks: text("evidence_links").array().notNull().default(sql`'{}'::text[]`),
});

export const decisionOutcomes = pgTable("decision_outcomes", {
  id: id(),
  reviewId: uuid("review_id").notNull().unique().references(() => decisionReviews.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  outcomeStatus: outcomeStatusEnum("outcome_status").notNull(),
  criteriaResults: jsonb("criteria_results").$type<{ metric: string; result: "met" | "partly" | "not_met" | "unknown" }[]>().notNull().default([]),
});

// ───────────────────────── External knowledge domain ─────────────────────────

export const externalCases = pgTable(
  "external_cases",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    category: categoryEnum("category").notNull(),
    decisionType: decisionTypeEnum("decision_type").notNull(),
    actorName: text("actor_name").notNull(),
    actorType: text("actor_type").notNull(),
    decisionDate: date("decision_date"),
    datePrecision: text("date_precision").notNull().default("year"),
    context: text("context").notNull(),
    problem: text("problem").notNull().default(""),
    alternativesDocumented: text("alternatives_documented"),
    decisionMade: text("decision_made").notNull(),
    reasonDocumented: text("reason_documented"),
    actionTaken: text("action_taken").notNull().default(""),
    expectedOutcomeDocumented: text("expected_outcome_documented"),
    observedOutcome: text("observed_outcome").notNull(),
    outcomeCategory: outcomeCategoryEnum("outcome_category").notNull(),
    outcomeObservedAt: date("outcome_observed_at"),
    observationPeriod: text("observation_period").notNull().default(""),
    lessons: text("lessons").notNull().default(""),
    limitations: text("limitations").notNull().default(""),
    domainFacets: jsonb("domain_facets").$type<Record<string, string>>().notNull().default({}),
    alternativeTags: text("alternative_tags").array().notNull().default(sql`'{}'::text[]`),
    constraintTags: text("constraint_tags").array().notNull().default(sql`'{}'::text[]`),
    evidenceClassification: provenanceEnum("evidence_classification").notNull(),
    verifiedBy: text("verified_by").notNull(),
    lastVerifiedAt: date("last_verified_at").notNull(),
    status: text("status").notNull().default("published"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("external_cases_cat_type_idx").on(t.category, t.decisionType),
    index("external_cases_fts_idx").using(
      "gin",
      sql`to_tsvector('english', ${t.title} || ' ' || ${t.context} || ' ' || ${t.decisionMade})`,
    ),
  ],
);

export const caseSources = pgTable("case_sources", {
  id: id(),
  url: text("url").notNull().unique(),
  publisher: text("publisher").notNull(),
  sourceType: sourceTypeEnum("source_type").notNull(),
  publishedAt: date("published_at"),
  retrievedAt: date("retrieved_at").notNull(),
  archivedUrl: text("archived_url"),
});

export const caseSourceLinks = pgTable(
  "case_source_links",
  {
    caseId: uuid("case_id").notNull().references(() => externalCases.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull().references(() => caseSources.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.caseId, t.sourceId] })],
);

export const caseClaims = pgTable("case_claims", {
  id: id(),
  caseId: uuid("case_id").notNull().references(() => externalCases.id, { onDelete: "cascade" }),
  claimType: claimTypeEnum("claim_type").notNull(),
  claimText: text("claim_text").notNull(),
  statedOrInferred: text("stated_or_inferred").notNull().default("stated"),
  provenanceClass: provenanceEnum("provenance_class").notNull(),
  causalLanguageInSource: boolean("causal_language_in_source").notNull().default(false),
});

export const claimSources = pgTable(
  "claim_sources",
  {
    claimId: uuid("claim_id").notNull().references(() => caseClaims.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull().references(() => caseSources.id, { onDelete: "cascade" }),
    support: supportEnum("support").notNull().default("supports"),
    locator: text("locator").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.claimId, t.sourceId] })],
);

// ───────────────────────── Research domain ─────────────────────────

export const consentRecords = pgTable("consent_records", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(), // "research_session" | "hybrid_mode"
  purpose: text("purpose").notNull(),
  payloadSha256: text("payload_sha256"),
  payloadText: text("payload_text"), // only if the user chose to keep a copy
  service: text("service").notNull(),
  model: text("model"),
  resultsSaved: boolean("results_saved").notNull().default(true),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const researchSessions = pgTable("research_sessions", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  decisionId: uuid("decision_id").references(() => decisionRecords.id, { onDelete: "set null" }),
  consentId: uuid("consent_id").notNull().references(() => consentRecords.id),
  queryText: text("query_text").notNull(),
  status: researchStatusEnum("status").notNull(),
  webSearchQueries: text("web_search_queries").array().notNull().default(sql`'{}'::text[]`),
  searchEntryPointHtml: text("search_entry_point_html"),
  resultText: text("result_text").notNull().default(""),
  createdAt: createdAt(),
});

export const researchSources = pgTable("research_sources", {
  id: id(),
  sessionId: uuid("session_id").notNull().references(() => researchSessions.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  uri: text("uri").notNull(),
  title: text("title"),
  domain: text("domain"),
  chunkIndex: integer("chunk_index").notNull(),
});

/** Grounded segments of the answer. Always "research candidates", never curated cases. */
export const researchFindings = pgTable("research_findings", {
  id: id(),
  sessionId: uuid("session_id").notNull().references(() => researchSessions.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  findingText: text("finding_text").notNull(),
  sourceChunkIndices: integer("source_chunk_indices").array().notNull().default(sql`'{}'::int[]`),
  grounded: boolean("grounded").notNull(),
});

// ───────────────────────── Intelligence domain ─────────────────────────

export const decisionMatches = pgTable(
  "decision_matches",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    decisionId: uuid("decision_id").notNull().references(() => decisionRecords.id, { onDelete: "cascade" }),
    externalCaseId: uuid("external_case_id").references(() => externalCases.id, { onDelete: "cascade" }),
    personalDecisionId: uuid("personal_decision_id").references(() => decisionRecords.id, { onDelete: "cascade" }),
    score: numeric("score").notNull(),
    label: matchLabelEnum("label").notNull(),
    algorithmVersion: text("algorithm_version").notNull(),
    explanation: jsonb("explanation").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("decision_matches_decision_idx").on(t.decisionId, t.label),
    check("decision_matches_one_target", sql`num_nonnulls(${t.externalCaseId}, ${t.personalDecisionId}) = 1`),
  ],
);

export const aiProcessingLogs = pgTable("ai_processing_logs", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  task: text("task").notNull(),
  inferenceSource: inferenceSourceEnum("inference_source"),
  success: boolean("success").notNull(),
  errorCode: text("error_code"),
  latencyMs: integer("latency_ms"),
  createdAt: createdAt(),
});

// ───────────────────────── Saved online references ─────────────────────────

/**
 * A result the user saved from the live online search. Personal and unverified:
 * it never enters the curated external_cases library on its own.
 */
export const webReferences = pgTable(
  "web_references",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title").notNull(),
    snippet: text("snippet").notNull().default(""),
    publisher: text("publisher").notNull().default("Wikipedia"),
    queryText: text("query_text").notNull().default(""),
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("web_references_user_url_idx").on(t.userId, t.url)],
);
