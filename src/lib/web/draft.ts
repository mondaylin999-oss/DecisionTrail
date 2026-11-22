/**
 * Turns a saved online reference into a case-file *draft* that follows
 * data/cases/_TEMPLATE.json. Everything that needs a human (what was decided,
 * what happened, limitations) is left as REPLACE_ME, so scripts/seed-cases.ts
 * refuses the file until someone has read the source and filled it in.
 */
export interface DraftInput {
  url: string;
  title: string;
  publisher: string;
}

export function slugify(title: string): string {
  const s = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || "web-reference";
}

export function draftFileName(ref: DraftInput): string {
  return `${slugify(ref.title)}.json`;
}

export function buildCaseDraft(ref: DraftInput, today: string) {
  const source = { url: ref.url, publisher: ref.publisher, source_type: "other", published_at: null, retrieved_at: today };
  const claim = (claim_type: string, locator: string) => ({
    claim_type,
    claim_text: "REPLACE_ME one factual statement, paraphrased in your own words",
    stated_or_inferred: "stated",
    provenance_class: "unverified",
    causal_language_in_source: false,
    sources: [{ url: ref.url, support: "supports", locator }],
  });
  return {
    _instructions:
      "Draft created from an online search result. Read the source, replace every REPLACE_ME in your own words, check the dates and outcome, add a second source where you can, then move this file to data/cases/. The seed script rejects files that still contain REPLACE_ME.",
    slug: slugify(ref.title),
    title: ref.title,
    category: "other",
    decision_type: "choose_one",
    actor_name: "REPLACE_ME organisation or person",
    actor_type: "company",
    decision_date: null,
    date_precision: "year",
    context: "REPLACE_ME what the situation was, from the source",
    problem: "REPLACE_ME",
    alternatives_documented: null,
    decision_made: "REPLACE_ME what they decided",
    reason_documented: null,
    action_taken: "REPLACE_ME",
    expected_outcome_documented: null,
    observed_outcome: "REPLACE_ME what was observed afterwards (or 'Not documented')",
    outcome_category: "unknown",
    outcome_observed_at: null,
    observation_period: "REPLACE_ME",
    lessons: "REPLACE_ME implications, phrased cautiously",
    limitations: "REPLACE_ME what is NOT known; why it may not transfer",
    domain_facets: { customer_segment: "unknown", company_stage: "unknown" },
    alternative_tags: ["other"],
    constraint_tags: [],
    evidence_classification: "unverified",
    verified_by: "REPLACE_ME your name",
    last_verified_at: today,
    sources: [source],
    claims: [claim("decision", "REPLACE_ME section or paragraph"), claim("outcome", "REPLACE_ME section or paragraph")],
  };
}
