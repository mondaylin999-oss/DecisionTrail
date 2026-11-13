/**
 * Loads human-verified historical cases from data/cases/*.json into PostgreSQL.
 *   npm run db:seed-cases
 * Refuses anything unverified: placeholders, claims without sources, no outcome claim.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../src/lib/db/client";
import * as s from "../src/lib/db/schema";
import {
  ALTERNATIVE_TAGS,
  CATEGORIES,
  COMPANY_STAGES,
  CONSTRAINT_TAGS,
  CUSTOMER_SEGMENTS,
  DECISION_TYPES,
  OUTCOME_CATEGORIES,
} from "../src/lib/vocab";

const provenance = z.enum(["primary", "corroborated", "independent_reporting", "self_reported", "unverified"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const CaseFileZ = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(5),
    category: z.enum(CATEGORIES),
    decision_type: z.enum(DECISION_TYPES),
    actor_name: z.string().min(1),
    actor_type: z.enum(["company", "startup", "public_body", "individual", "team"]),
    decision_date: isoDate.nullable(),
    date_precision: z.enum(["day", "month", "year"]),
    context: z.string().min(10),
    problem: z.string().default(""),
    alternatives_documented: z.string().nullable(),
    decision_made: z.string().min(5),
    reason_documented: z.string().nullable(),
    action_taken: z.string().default(""),
    expected_outcome_documented: z.string().nullable(),
    observed_outcome: z.string().min(3),
    outcome_category: z.enum(OUTCOME_CATEGORIES),
    outcome_observed_at: isoDate.nullable(),
    observation_period: z.string().default(""),
    lessons: z.string().default(""),
    limitations: z.string().min(5, "Every case must state its limitations"),
    domain_facets: z.object({ customer_segment: z.enum(CUSTOMER_SEGMENTS).optional(), company_stage: z.enum(COMPANY_STAGES).optional() }),
    alternative_tags: z.array(z.enum(ALTERNATIVE_TAGS)),
    constraint_tags: z.array(z.enum(CONSTRAINT_TAGS)),
    evidence_classification: provenance,
    verified_by: z.string().min(2),
    last_verified_at: isoDate,
    sources: z
      .array(
        z.object({
          url: z.string().url(),
          publisher: z.string().min(1),
          source_type: z.enum(["primary", "filing", "academic", "news", "case_study", "interview", "postmortem", "documentation", "other"]),
          published_at: isoDate.nullable(),
          retrieved_at: isoDate,
        }),
      )
      .min(1),
    claims: z
      .array(
        z.object({
          claim_type: z.enum(["context", "decision", "reason", "action", "outcome", "lesson"]),
          claim_text: z.string().min(5),
          stated_or_inferred: z.enum(["stated", "inferred"]),
          provenance_class: provenance,
          causal_language_in_source: z.boolean().default(false),
          sources: z
            .array(z.object({ url: z.string().url(), support: z.enum(["supports", "contradicts", "partial"]), locator: z.string().default("") }))
            .min(1, "Every claim needs at least one source"),
        }),
      )
      .min(1),
  })
  .superRefine((c, ctx) => {
    const urls = new Set(c.sources.map((x) => x.url));
    c.claims.forEach((cl, i) =>
      cl.sources.forEach((cs) => {
        if (!urls.has(cs.url)) ctx.addIssue({ code: "custom", path: ["claims", i], message: `Claim cites ${cs.url}, which is not listed in sources` });
      }),
    );
    if (c.outcome_category !== "unknown" && !c.claims.some((cl) => cl.claim_type === "outcome")) {
      ctx.addIssue({ code: "custom", path: ["claims"], message: "A known outcome needs at least one sourced outcome claim" });
    }
  });

async function main() {
  const dir = join(process.cwd(), "data", "cases");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  if (!files.length) {
    console.log("No case files found in data/cases (files starting with '_' are ignored). Nothing to seed.");
    return;
  }
  const db = getDb();
  let ok = 0;
  for (const f of files) {
    const raw = readFileSync(join(dir, f), "utf8");
    if (raw.includes("REPLACE_ME")) {
      console.error(`✗ ${f}: still contains REPLACE_ME placeholders. Skipped.`);
      continue;
    }
    const parsed = CaseFileZ.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error(`✗ ${f}:\n  ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n  ")}`);
      continue;
    }
    const c = parsed.data;
    await db.transaction(async (tx) => {
      await tx.delete(s.externalCases).where(eq(s.externalCases.slug, c.slug)); // cascades claims/links
      const [row] = await tx
        .insert(s.externalCases)
        .values({
          slug: c.slug,
          title: c.title,
          category: c.category,
          decisionType: c.decision_type,
          actorName: c.actor_name,
          actorType: c.actor_type,
          decisionDate: c.decision_date,
          datePrecision: c.date_precision,
          context: c.context,
          problem: c.problem,
          alternativesDocumented: c.alternatives_documented,
          decisionMade: c.decision_made,
          reasonDocumented: c.reason_documented,
          actionTaken: c.action_taken,
          expectedOutcomeDocumented: c.expected_outcome_documented,
          observedOutcome: c.observed_outcome,
          outcomeCategory: c.outcome_category,
          outcomeObservedAt: c.outcome_observed_at,
          observationPeriod: c.observation_period,
          lessons: c.lessons,
          limitations: c.limitations,
          domainFacets: c.domain_facets,
          alternativeTags: c.alternative_tags,
          constraintTags: c.constraint_tags,
          evidenceClassification: c.evidence_classification,
          verifiedBy: c.verified_by,
          lastVerifiedAt: c.last_verified_at,
        })
        .returning({ id: s.externalCases.id });

      const sourceIds = new Map<string, string>();
      for (const src of c.sources) {
        const [sr] = await tx
          .insert(s.caseSources)
          .values({ url: src.url, publisher: src.publisher, sourceType: src.source_type, publishedAt: src.published_at, retrievedAt: src.retrieved_at })
          .onConflictDoUpdate({ target: s.caseSources.url, set: { publisher: src.publisher, retrievedAt: src.retrieved_at } })
          .returning({ id: s.caseSources.id });
        sourceIds.set(src.url, sr.id);
        await tx.insert(s.caseSourceLinks).values({ caseId: row.id, sourceId: sr.id }).onConflictDoNothing();
      }
      for (const cl of c.claims) {
        const [cr] = await tx
          .insert(s.caseClaims)
          .values({ caseId: row.id, claimType: cl.claim_type, claimText: cl.claim_text, statedOrInferred: cl.stated_or_inferred, provenanceClass: cl.provenance_class, causalLanguageInSource: cl.causal_language_in_source })
          .returning({ id: s.caseClaims.id });
        for (const cs of cl.sources) {
          await tx.insert(s.claimSources).values({ claimId: cr.id, sourceId: sourceIds.get(cs.url)!, support: cs.support, locator: cs.locator }).onConflictDoNothing();
        }
      }
    });
    ok++;
    console.log(`✓ ${f}`);
  }
  const negativeish = (await db.select({ o: s.externalCases.outcomeCategory }).from(s.externalCases)).filter((r) => ["negative", "mixed", "reversed"].includes(r.o)).length;
  const total = (await db.select({ id: s.externalCases.id }).from(s.externalCases)).length;
  console.log(`\nSeeded ${ok}/${files.length} files. Library: ${total} cases, ${negativeish} negative/mixed/reversed (target ≥ 40% to avoid survivorship bias).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
