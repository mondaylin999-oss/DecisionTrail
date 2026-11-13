/**
 * Adds clearly labelled DEMO personal decisions to one account (is_demo = true).
 * The user must have signed in once so their row exists.
 *   npm run db:seed-demo -- --email you@example.com [--reset]
 * These are fictional sample records, NOT real users or real historical cases.
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "../src/lib/db/client";
import { createDecision, reviewDecision } from "../src/lib/db/repo";
import * as s from "../src/lib/db/schema";
import type { CreateDecision } from "../src/lib/validation";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const iso = (d: string) => new Date(d).toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

const base = (x: Partial<CreateDecision> & Pick<CreateDecision, "title" | "category" | "alternatives">): CreateDecision => ({
  decision_type: "choose_one",
  context: "",
  objective: "",
  time_horizon: "months",
  facets: { customer_segment: "b2c", company_stage: "pre_revenue" },
  constraints: [],
  expected_benefits: [],
  risks: [],
  assumptions: [],
  chosen_index: 0,
  reasons: "",
  expected_outcome: "",
  success_criteria: [],
  decided_at: null,
  review_due_at: null,
  field_origins: {},
  ...x,
});

async function main() {
  const email = arg("email");
  if (!email) throw new Error("Usage: npm run db:seed-demo -- --email you@example.com [--reset]");
  const db = getDb();
  const [user] = await db.select().from(s.users).where(eq(s.users.email, email));
  if (!user) throw new Error(`No user with email ${email}. Sign in to the app once first.`);

  if (process.argv.includes("--reset")) {
    await db.delete(s.decisionRecords).where(and(eq(s.decisionRecords.userId, user.id), eq(s.decisionRecords.isDemo, true)));
    console.log("Removed existing demo records.");
  }

  // 1) Past pricing decision with a reviewed, partly disappointing outcome.
  const d1 = await createDecision(
    user.id,
    base({
      title: "DEMO: Launch my browser extension with a free tier",
      category: "pricing",
      context: "DEMO DATA. Solo developer launching a productivity browser extension with a small audience and no marketing budget.",
      objective: "Get first users quickly and convert some of them to paid.",
      constraints: ["budget_limited", "small_team"],
      alternatives: [
        { label: "Free tier + paid Pro", description: "Core features free, advanced features paid", tag: "freemium", origin: "user_added" },
        { label: "Paid only with 14-day trial", description: "No free tier", tag: "free_trial", origin: "user_added" },
      ],
      assumptions: [
        { text: "About 5% of free users will upgrade to Pro within 3 months", origin: "user_added" },
        { text: "Support load from free users will stay small", origin: "user_added" },
      ],
      reasons: "A free tier should lower the barrier and spread by word of mouth.",
      expected_outcome: "Around 5% of free users upgrade within 3 months.",
      success_criteria: [{ metric: "Free-to-paid conversion", target: "5%", by: "2025-06-10" }],
      decided_at: iso("2025-03-10"),
      review_due_at: iso("2025-06-10"),
    }),
    { isDemo: true },
  );
  const a1 = await db.select().from(s.decisionAssumptions).where(eq(s.decisionAssumptions.decisionId, d1));
  await reviewDecision(
    user.id,
    d1,
    {
      what_happened: "DEMO DATA. Many installs, but well under 1% upgraded. Free users generated most support requests.",
      unexpected_events: "A competitor made similar features free.",
      would_do_differently: "Define the paid value more clearly before launch; limit the free tier.",
      lessons: "Conversion from a generous free tier was far lower than I assumed. Test willingness to pay early.",
      outcome_status: "partially_achieved",
      process_checklist: { considered_alternatives: true, checked_evidence: false, named_risks: true, set_criteria: true },
      assumption_results: a1.map((a) => ({ id: a.id, result: "failed", note: "" })),
      criteria_results: [{ metric: "Free-to-paid conversion", result: "not_met" }],
      evidence_links: [],
    },
    new Date("2025-06-15"),
  );

  // 2) Past technology decision (should NOT strongly match a pricing question).
  const d2 = await createDecision(
    user.id,
    base({
      title: "DEMO: Use PostgreSQL for my side project",
      category: "technology",
      context: "DEMO DATA. Small web app with relational data (users, projects, invoices).",
      objective: "Pick a database I can maintain alone.",
      facets: { customer_segment: "b2c", company_stage: "idea" },
      alternatives: [
        { label: "PostgreSQL", description: "Relational, managed hosting", tag: "relational_db", origin: "user_added" },
        { label: "MongoDB", description: "Document store", tag: "document_db", origin: "user_added" },
      ],
      assumptions: [{ text: "Relational queries will matter more than flexible schemas", origin: "user_added" }],
      reasons: "My data is relational and I know SQL.",
      expected_outcome: "Low maintenance; no painful migrations in the first year.",
      decided_at: iso("2026-01-20"),
      review_due_at: iso("2026-07-20"),
    }),
    { isDemo: true },
  );
  const a2 = await db.select().from(s.decisionAssumptions).where(eq(s.decisionAssumptions.decisionId, d2));
  await reviewDecision(
    user.id,
    d2,
    {
      what_happened: "DEMO DATA. Worked well; one schema migration, no outages.",
      unexpected_events: "",
      would_do_differently: "Nothing major.",
      lessons: "Choosing the tool that matched the data shape and my skills kept maintenance low.",
      outcome_status: "achieved",
      process_checklist: { considered_alternatives: true, checked_evidence: true, named_risks: true, set_criteria: false },
      assumption_results: a2.map((a) => ({ id: a.id, result: "held", note: "" })),
      criteria_results: [],
      evidence_links: [],
    },
    new Date("2026-07-22"),
  );

  // 3) Decided, review overdue: lets you demo the review wizard immediately.
  await createDecision(
    user.id,
    base({
      title: "DEMO: Raise the price of my scheduling add-on",
      category: "pricing",
      decision_type: "yes_no",
      context: "DEMO DATA. Existing small customer base; costs went up.",
      objective: "Improve margin without losing many customers.",
      facets: { customer_segment: "b2b", company_stage: "early" },
      constraints: ["existing_customers"],
      alternatives: [
        { label: "Raise price for new customers only", description: "Grandfather existing ones", tag: "price_increase", origin: "user_added" },
        { label: "Keep current price", description: "", tag: "continue", origin: "user_added" },
      ],
      assumptions: [{ text: "Fewer than 10% of new prospects will be lost because of the higher price", origin: "user_added" }],
      reasons: "Grandfathering protects goodwill while improving margin on new sales.",
      expected_outcome: "New-customer signups roughly stable; revenue per new customer up.",
      success_criteria: [{ metric: "New signups per month", target: "≥ 90% of previous average", by: daysAgo(1).slice(0, 10) }],
      decided_at: daysAgo(60),
      review_due_at: daysAgo(1),
    }),
    { isDemo: true },
  );

  console.log(`Added 3 DEMO decisions for ${email}.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
