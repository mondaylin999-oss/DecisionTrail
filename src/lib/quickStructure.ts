/**
 * Fills in a decision's structure from plain text with fixed keyword rules:
 * no AI, no network. It is a starting point the user can edit, so when nothing
 * matches it says "other"/"unknown" rather than guessing.
 */
import type { StructuredDecision, StructuredOption } from "./types";
import type { AlternativeTag, Category, CompanyStage, ConstraintTag } from "./vocab";

const CATEGORY_RULES: [Category, RegExp][] = [
  ["pricing", /\b(pric(e|es|ing)|subscription|free plan|freemium|free trial|paid|fee|discount|licen[cs]e|monetis|monetiz)/gi],
  ["hiring", /\b(hire|hiring|recruit|layoff|lay off|employees?|staff|remote work|work from home|salar(y|ies)|four-day week)/gi],
  ["technology", /\b(database|postgres|mongodb|monolith|microservices?|serverless|cloud|aws|framework|programming language|architecture|self-host|migrat)/gi],
  ["career", /\b(intern(ship)?s?|inten?r?n?ship|resume|cv|freelanc|my job|quit|career|promotion|job offer|leave my|switch jobs|startup job)/gi],
  ["education", /\b(degree|universit|college|course|school|master'?s|bootcamp|study|student|exam|phd|scholarship)/gi],
  ["growth", /\b(marketing|referral|advertis|acquisition|viral|growth|users? sign)/gi],
  ["product", /\b(feature|redesign|launch|product|logo|packaging|app)\b/gi],
  ["operations", /\b(process|operations|outage|deploy|meeting|supplier|office|logistics)/gi],
  ["business_strategy", /\b(acquire|merger|merge|partner|pivot|expand|invest|shut down|sell the company|strategy)/gi],
  ["personal", /\b(move house|relocate|marriage|family|personal|buy a (house|car)|rent)/gi],
];

const TAG_RULES: [AlternativeTag, RegExp][] = [
  ["freemium", /\bfreemium\b/i],
  ["free_trial", /\b(free )?trial\b/i],
  ["free_plan", /\bfree\b/i],
  ["usage_based", /\b(usage[- ]based|pay[- ]as[- ]you[- ]go|per[- ](use|request|install))/i],
  ["one_time_purchase", /\b(one[- ]time|lifetime|perpetual)/i],
  ["price_increase", /\b(rais\w*|increas\w*)\b.{0,20}\b(prices?|fees?)\b|\b(price|fee) (increase|rise)/i],
  ["price_decrease", /\b(lower\w*|cut\w*|reduc\w*)\b.{0,20}\b(prices?|fees?)\b|\bdiscount/i],
  ["paid_subscription", /\b(subscription|paid plan|monthly fee|paid)\b/i],
  ["open_source", /\bopen[- ]sourc/i],
  ["microservices", /\bmicroservices?\b/i],
  ["monolith", /\bmonolith/i],
  ["serverless", /\bserverless\b/i],
  ["document_db", /\b(mongodb|document (db|database)|nosql|dynamodb|firestore)\b/i],
  ["relational_db", /\b(postgres\w*|mysql|relational|sql database)\b/i],
  ["self_hosted", /\b(self[- ]host|on[- ]prem|own (servers?|hardware))/i],
  ["managed_service", /\bmanaged (service|database)/i],
  ["cloud", /\b(cloud|aws|azure|gcp)\b/i],
  ["outsource", /\b(outsourc|agency|contractors?)/i],
  ["hire", /\b(hire|hiring|recruit)/i],
  ["buy", /\b(buy|acquire|purchase)\b/i],
  ["build", /\b(build|in-house)\b/i],
  ["delay", /\b(delay|wait|postpone|later)\b/i],
  ["launch_now", /\blaunch\b/i],
  ["stop", /\b(stop|shut down|discontinue|quit|end)\b/i],
  ["continue", /\b(continue|keep)\b/i],
];

const CONSTRAINT_RULES: [ConstraintTag, RegExp][] = [
  ["budget_limited", /\b(limited|small|tight|low) budget|budget is (limited|tight|small)|little money/i],
  ["small_team", /\b(small team|team is small|solo|only developer|just me|few people)/i],
  ["time_pressure", /\b(deadline|urgent|quickly|time pressure)/i],
  ["regulated", /\b(regulat|complian|hipaa|gdpr|medical data)/i],
  ["technical_debt", /\b(technical debt|legacy code)/i],
  ["existing_customers", /\bexisting (customers|users)/i],
];

/** Also splits "year.should i" where the space after the full stop is missing. */
const SENTENCE = /(?<=[.!?])\s+|\n|(?<=[.!?])(?=(?:should|do|is|can|i|we|what|which|how|would)\b)/i;

export function tagFor(text: string): AlternativeTag {
  return TAG_RULES.find(([, re]) => re.test(text))?.[0] ?? "other";
}

function categoryFor(text: string): Category {
  let best: Category = "other";
  let top = 0;
  for (const [c, re] of CATEGORY_RULES) {
    const n = text.match(re)?.length ?? 0;
    if (n > top) [best, top] = [c, n];
  }
  return best;
}

/** "Should we offer a free plan or a paid subscription?" → two options; null if not clearly stated. */
export function optionsIn(text: string): string[] | null {
  const sentence = text.split(/(?<=[.!?])\s+|\n/).find((s) => /\bor\b/i.test(s));
  if (!sentence) return null;
  const tail = sentence.replace(/^.*\b(between|choose|choosing|whether to|should (?:i|we)|either)\b/i, "");
  const parts = tail
    .replace(/[.!?]+\s*$/, "")
    .split(/,\s*(?:or\s+)?|\s+or\s+/i)
    .map((p) => p.replace(/^\s*(to|a|an|the|offer(?:ing)?|use|using)\s+/i, "").replace(/^\s*(a|an|the)\s+/i, "").trim())
    .filter(Boolean);
  if (parts.length < 2 || parts.length > 5 || parts.some((p) => p.length > 60)) return null;
  return parts.map((p) => p[0].toUpperCase() + p.slice(1));
}

export function quickStructure(text: string, typedOptions: string[]): StructuredDecision {
  const clean = text.trim();
  const typed = typedOptions.map((o) => o.trim()).filter(Boolean);
  const found = typed.length ? typed : optionsIn(clean);
  const labels = found && found.length > 1 ? found : found ? [...found, "Don't do this"] : ["Yes", "No"];
  const alternatives: StructuredOption[] = labels.map((l) => ({
    label: l.slice(0, 120),
    description: "",
    // For a plain yes/no question the subject is in the question itself.
    tag: l === "No" || l === "Don't do this" ? "other" : tagFor(l === "Yes" ? clean : l),
    origin: "user_added",
  }));
  const first = clean.split(SENTENCE).find((s) => /\?|\b(should|choose|choosing|whether|decid)/i.test(s)) ?? clean;
  const segments = [/\bb2b\b|\bbusinesses\b|\bcompanies\b|\bclinics\b/i.test(clean), /\bb2c\b|\bconsumers?\b/i.test(clean)];
  const stage: CompanyStage = /\benterprise\b/i.test(clean) ? "enterprise" : /\bpre[- ]revenue\b/i.test(clean) ? "pre_revenue" : /\bearly[- ]stage\b/i.test(clean) ? "early" : /\bgrowth[- ]stage\b/i.test(clean) ? "growth" : "unknown";
  return {
    title: first.length > 120 ? first.slice(0, 117).trimEnd() + "…" : first,
    category: categoryFor(`${clean} ${typed.join(" ")}`),
    decision_type: found && found.length > 1 ? "choose_one" : "yes_no",
    context: clean,
    objective: "",
    time_horizon: "months",
    alternatives,
    constraints: CONSTRAINT_RULES.filter(([, re]) => re.test(clean)).map(([c]) => c),
    assumptions: [],
    expected_benefits: [],
    risks: [],
    missing_information: [],
    facets: { customer_segment: segments[0] && segments[1] ? "both" : segments[0] ? "b2b" : segments[1] ? "b2c" : "unknown", company_stage: stage },
    field_origins: {},
  };
}
