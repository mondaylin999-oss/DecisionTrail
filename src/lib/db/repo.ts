import "server-only";
/**
 * Data access. Every personal-domain function takes `uid` from the verified
 * Firebase ID token and filters by it. Never pass a client-supplied user id.
 */
import { createHash } from "node:crypto";
import { and, asc, count, desc, eq, inArray, lte, ne, sql } from "drizzle-orm";
import { ALGORITHM_VERSION, assessSufficiency, categoriesComparable, scoreCandidate, toOrTsQuery, type MatchAttributes } from "../matching/score";
import type { MatchResult, Sufficiency } from "../types";
import type { CreateDecision, MatchRequest, ReviewInput } from "../validation";
import { CATEGORIES, type Category, type CompanyStage, type PrivacyMode } from "../vocab";
import { getDb } from "./client";
import * as s from "./schema";

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// ───────────── users ─────────────

export async function ensureUser(uid: string, email: string | null, name: string | null) {
  const db = getDb();
  await db.insert(s.users).values({ id: uid, email, displayName: name }).onConflictDoNothing();
  const [u] = await db.select().from(s.users).where(eq(s.users.id, uid));
  return u;
}

export async function setPrivacyMode(uid: string, mode: PrivacyMode) {
  const db = getDb();
  await db.update(s.users).set({ privacyMode: mode }).where(eq(s.users.id, uid));
  if (mode !== "private") {
    await db.insert(s.consentRecords).values({
      userId: uid,
      scope: mode === "hybrid" ? "hybrid_mode" : "cloud_research_mode",
      purpose: `User switched privacy mode to ${mode}`,
      service: "Firebase AI Logic · Gemini (cloud)",
    });
  }
}

// ───────────── decisions ─────────────

export async function listDecisions(uid: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: s.decisionRecords.id,
      title: s.decisionRecords.title,
      category: s.decisionRecords.category,
      status: s.decisionRecords.status,
      decidedAt: s.decisionRecords.decidedAt,
      reviewDueAt: s.decisionRecords.reviewDueAt,
      isDemo: s.decisionRecords.isDemo,
      outcomeStatus: s.decisionOutcomes.outcomeStatus,
    })
    .from(s.decisionRecords)
    .leftJoin(s.decisionReviews, eq(s.decisionReviews.decisionId, s.decisionRecords.id))
    .leftJoin(s.decisionOutcomes, eq(s.decisionOutcomes.reviewId, s.decisionReviews.id))
    .where(eq(s.decisionRecords.userId, uid))
    .orderBy(desc(s.decisionRecords.createdAt));
  const now = Date.now();
  return rows.map((r) => ({
    ...r,
    status: r.status === "decided" && r.reviewDueAt && r.reviewDueAt.getTime() <= now ? "awaiting_review" : r.status,
  }));
}

export async function getDecision(uid: string, id: string) {
  const db = getDb();
  const [record] = await db
    .select()
    .from(s.decisionRecords)
    .where(and(eq(s.decisionRecords.id, id), eq(s.decisionRecords.userId, uid)));
  if (!record) return null;
  const [options, assumptions, versions, reviews, matches] = await Promise.all([
    db.select().from(s.decisionOptions).where(and(eq(s.decisionOptions.decisionId, id), eq(s.decisionOptions.userId, uid))).orderBy(asc(s.decisionOptions.position)),
    db.select().from(s.decisionAssumptions).where(and(eq(s.decisionAssumptions.decisionId, id), eq(s.decisionAssumptions.userId, uid))),
    db.select().from(s.decisionVersions).where(and(eq(s.decisionVersions.decisionId, id), eq(s.decisionVersions.userId, uid))).orderBy(asc(s.decisionVersions.versionNo)),
    db
      .select({ review: s.decisionReviews, outcome: s.decisionOutcomes })
      .from(s.decisionReviews)
      .leftJoin(s.decisionOutcomes, eq(s.decisionOutcomes.reviewId, s.decisionReviews.id))
      .where(and(eq(s.decisionReviews.decisionId, id), eq(s.decisionReviews.userId, uid)))
      .orderBy(desc(s.decisionReviews.reviewedAt)),
    db.select().from(s.decisionMatches).where(and(eq(s.decisionMatches.decisionId, id), eq(s.decisionMatches.userId, uid))),
  ]);
  return { record, options, assumptions, versions, reviews, matches };
}

export async function createDecision(uid: string, input: CreateDecision, opts: { isDemo?: boolean } = {}) {
  const db = getDb();
  const id = await db.transaction(async (tx) => {
    const decided = input.chosen_index !== null;
    const [rec] = await tx
      .insert(s.decisionRecords)
      .values({
        userId: uid,
        title: input.title,
        category: input.category,
        decisionType: input.decision_type,
        context: input.context,
        objective: input.objective,
        timeHorizon: input.time_horizon,
        domainFacets: input.facets,
        constraintTags: input.constraints,
        expectedBenefits: input.expected_benefits,
        risks: input.risks,
        status: decided ? "decided" : "draft",
        reasons: input.reasons,
        expectedOutcome: input.expected_outcome,
        successCriteria: input.success_criteria,
        decidedAt: input.decided_at ? new Date(input.decided_at) : decided ? new Date() : null,
        reviewDueAt: input.review_due_at ? new Date(input.review_due_at) : null,
        fieldOrigins: input.field_origins,
        isDemo: opts.isDemo ?? false,
      })
      .returning({ id: s.decisionRecords.id });

    const options = await tx
      .insert(s.decisionOptions)
      .values(
        input.alternatives.map((a, i) => ({
          decisionId: rec.id,
          userId: uid,
          label: a.label,
          description: a.description,
          alternativeTag: a.tag,
          origin: a.origin,
          position: i,
        })),
      )
      .returning({ id: s.decisionOptions.id });

    if (input.assumptions.length) {
      await tx.insert(s.decisionAssumptions).values(
        input.assumptions.map((a) => ({ decisionId: rec.id, userId: uid, text: a.text, origin: a.origin })),
      );
    }
    if (input.chosen_index !== null && options[input.chosen_index]) {
      await tx
        .update(s.decisionRecords)
        .set({ chosenOptionId: options[input.chosen_index].id })
        .where(eq(s.decisionRecords.id, rec.id));
    }
    // Frozen v1: the review always compares against this snapshot.
    await tx.insert(s.decisionVersions).values({
      decisionId: rec.id,
      userId: uid,
      versionNo: 1,
      snapshot: input,
      changeReason: "initial decision",
    });
    return rec.id;
  });

  // Persist the matches that were shown, for the audit trail.
  const { matches } = await findMatches(uid, {
    category: input.category,
    decision_type: input.decision_type,
    title: input.title,
    context: input.context,
    objective: input.objective,
    alternative_tags: input.alternatives.map((a) => a.tag),
    constraint_tags: input.constraints,
    facets: input.facets,
  }, id);
  if (matches.length) {
    await db.insert(s.decisionMatches).values(
      matches.map((m) => ({
        userId: uid,
        decisionId: id,
        externalCaseId: m.targetType === "external_case" ? m.targetId : null,
        personalDecisionId: m.targetType === "personal_decision" ? m.targetId : null,
        score: String(m.score),
        label: m.label,
        algorithmVersion: ALGORITHM_VERSION,
        explanation: m.explanation,
      })),
    );
  }
  return id;
}

export async function reviewDecision(uid: string, id: string, input: ReviewInput, reviewedAt?: Date) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [rec] = await tx
      .select({ id: s.decisionRecords.id })
      .from(s.decisionRecords)
      .where(and(eq(s.decisionRecords.id, id), eq(s.decisionRecords.userId, uid)));
    if (!rec) return null;
    const [review] = await tx
      .insert(s.decisionReviews)
      .values({
        decisionId: id,
        userId: uid,
        reviewedAt: reviewedAt ?? new Date(),
        whatHappened: input.what_happened,
        unexpectedEvents: input.unexpected_events,
        wouldDoDifferently: input.would_do_differently,
        lessons: input.lessons,
        processChecklist: input.process_checklist,
        evidenceLinks: input.evidence_links,
      })
      .returning({ id: s.decisionReviews.id });
    await tx.insert(s.decisionOutcomes).values({
      reviewId: review.id,
      userId: uid,
      outcomeStatus: input.outcome_status,
      criteriaResults: input.criteria_results,
    });
    for (const a of input.assumption_results) {
      await tx
        .update(s.decisionAssumptions)
        .set({ reviewResult: a.result, reviewNote: a.note })
        .where(and(eq(s.decisionAssumptions.id, a.id), eq(s.decisionAssumptions.decisionId, id), eq(s.decisionAssumptions.userId, uid)));
    }
    // The original record (and its frozen v1) is never overwritten; only status changes.
    await tx.update(s.decisionRecords).set({ status: "reviewed", updatedAt: new Date() }).where(eq(s.decisionRecords.id, id));
    return review.id;
  });
}

// ───────────── matching ─────────────

function comparableCategories(c: Category): Category[] {
  return CATEGORIES.filter((x) => categoriesComparable(c, x));
}

/** ts_rank_cd with normalisation 32 is rank/(rank+1); scale it into a usable 0..1 range. */
const RANK_SCALE = 3;

export async function findMatches(
  uid: string,
  req: MatchRequest,
  excludeDecisionId?: string,
): Promise<{ matches: MatchResult[]; sufficiency: Sufficiency }> {
  const db = getDb();
  const cats = comparableCategories(req.category);
  const tsq = toOrTsQuery(`${req.title} ${req.objective} ${req.context}`);
  const query: MatchAttributes = {
    category: req.category,
    decisionType: req.decision_type,
    alternativeTags: req.alternative_tags,
    constraintTags: req.constraint_tags,
    facets: req.facets,
    year: new Date().getFullYear(),
  };

  const extRank = tsq
    ? sql<number>`ts_rank_cd(to_tsvector('english', ${s.externalCases.title} || ' ' || ${s.externalCases.context} || ' ' || ${s.externalCases.decisionMade}), to_tsquery('english', ${tsq}), 32)`
    : sql<number>`0`;
  const external = await db
    .select({ c: s.externalCases, rank: extRank })
    .from(s.externalCases)
    .where(and(eq(s.externalCases.status, "published"), inArray(s.externalCases.category, cats)));

  const perRank = tsq
    ? sql<number>`ts_rank_cd(to_tsvector('english', ${s.decisionRecords.title} || ' ' || ${s.decisionRecords.context} || ' ' || ${s.decisionRecords.objective}), to_tsquery('english', ${tsq}), 32)`
    : sql<number>`0`;
  const personal = await db
    .select({ d: s.decisionRecords, rank: perRank })
    .from(s.decisionRecords)
    .where(
      and(
        eq(s.decisionRecords.userId, uid),
        inArray(s.decisionRecords.category, cats),
        excludeDecisionId ? ne(s.decisionRecords.id, excludeDecisionId) : undefined,
      ),
    );

  const personalIds = personal.map((p) => p.d.id);
  const [opts, assumptions, outcomes] = personalIds.length
    ? await Promise.all([
        db.select().from(s.decisionOptions).where(and(eq(s.decisionOptions.userId, uid), inArray(s.decisionOptions.decisionId, personalIds))),
        db.select().from(s.decisionAssumptions).where(and(eq(s.decisionAssumptions.userId, uid), inArray(s.decisionAssumptions.decisionId, personalIds))),
        db
          .select({ decisionId: s.decisionReviews.decisionId, lessons: s.decisionReviews.lessons, whatHappened: s.decisionReviews.whatHappened, status: s.decisionOutcomes.outcomeStatus })
          .from(s.decisionReviews)
          .innerJoin(s.decisionOutcomes, eq(s.decisionOutcomes.reviewId, s.decisionReviews.id))
          .where(and(eq(s.decisionReviews.userId, uid), inArray(s.decisionReviews.decisionId, personalIds)))
          .orderBy(desc(s.decisionReviews.reviewedAt)),
      ])
    : [[], [], []];

  const results: MatchResult[] = [];

  for (const { c, rank } of external) {
    const year = c.decisionDate ? Number(c.decisionDate.slice(0, 4)) : undefined;
    const r = scoreCandidate(query, {
      category: c.category,
      decisionType: c.decisionType,
      alternativeTags: c.alternativeTags,
      constraintTags: c.constraintTags,
      facets: c.domainFacets as MatchAttributes["facets"],
      year,
      textRank: Math.min(1, Number(rank) * RANK_SCALE),
    });
    if (!r.label) continue;
    results.push({
      targetType: "external_case",
      targetId: c.id,
      title: c.title,
      score: r.score,
      label: r.label,
      reasons: r.reasons,
      explanation: r.explanation,
      outcomeKnown: c.outcomeCategory !== "unknown",
      outcomeCategory: c.outcomeCategory,
      summary: { actorName: c.actorName, decisionMade: c.decisionMade, observedOutcome: c.observedOutcome, lessons: c.lessons },
    });
  }

  for (const { d, rank } of personal) {
    const out = outcomes.find((o) => o.decisionId === d.id);
    const as = assumptions.filter((a) => a.decisionId === d.id);
    const r = scoreCandidate(query, {
      category: d.category,
      decisionType: d.decisionType,
      alternativeTags: opts.filter((o) => o.decisionId === d.id).map((o) => o.alternativeTag),
      constraintTags: d.constraintTags,
      facets: d.domainFacets as { customer_segment?: string; company_stage?: CompanyStage },
      year: d.decidedAt?.getFullYear(),
      textRank: Math.min(1, Number(rank) * RANK_SCALE),
    });
    if (!r.label) continue;
    results.push({
      targetType: "personal_decision",
      targetId: d.id,
      title: d.title,
      score: r.score,
      label: r.label,
      reasons: r.reasons,
      explanation: r.explanation,
      outcomeKnown: Boolean(out && out.status !== "pending"),
      outcomeStatus: out?.status,
      isDemo: d.isDemo,
      summary: {
        expectedOutcome: d.expectedOutcome,
        observedOutcome: out?.whatHappened,
        lessons: out?.lessons,
        failedAssumptions: as.filter((a) => a.reviewResult === "failed").map((a) => a.text),
        heldAssumptions: as.filter((a) => a.reviewResult === "held").map((a) => a.text),
      },
    });
  }

  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, 10);
  return { matches: top, sufficiency: assessSufficiency(top) };
}

// ───────────── external cases ─────────────

export async function listCases() {
  const db = getDb();
  const cases = await db.select().from(s.externalCases).where(eq(s.externalCases.status, "published")).orderBy(asc(s.externalCases.title));
  if (!cases.length) return [];
  const ids = cases.map((c) => c.id);
  const [claims, links] = await Promise.all([
    db.select().from(s.caseClaims).where(inArray(s.caseClaims.caseId, ids)),
    db
      .select({ caseId: s.caseSourceLinks.caseId, source: s.caseSources })
      .from(s.caseSourceLinks)
      .innerJoin(s.caseSources, eq(s.caseSources.id, s.caseSourceLinks.sourceId))
      .where(inArray(s.caseSourceLinks.caseId, ids)),
  ]);
  const claimIds = claims.map((c) => c.id);
  const claimLinks = claimIds.length
    ? await db.select().from(s.claimSources).where(inArray(s.claimSources.claimId, claimIds))
    : [];
  return cases.map((c) => ({
    ...c,
    sources: links.filter((l) => l.caseId === c.id).map((l) => l.source),
    claims: claims
      .filter((cl) => cl.caseId === c.id)
      .map((cl) => ({ ...cl, sources: claimLinks.filter((x) => x.claimId === cl.id) })),
  }));
}

// ───────────── consent & research ─────────────

export async function createConsent(uid: string, input: { purpose: string; payloadText: string; keepCopy: boolean; saveResults: boolean; model: string }) {
  const db = getDb();
  const [row] = await db
    .insert(s.consentRecords)
    .values({
      userId: uid,
      scope: "research_session",
      purpose: input.purpose,
      payloadSha256: sha256(input.payloadText),
      payloadText: input.keepCopy ? input.payloadText : null,
      service: "Firebase AI Logic · Gemini (cloud) · Grounding with Google Search",
      model: input.model,
      resultsSaved: input.saveResults,
    })
    .returning({ id: s.consentRecords.id, grantedAt: s.consentRecords.grantedAt });
  return row;
}

const CONSENT_TTL_MS = 15 * 60 * 1000;

export async function checkConsent(uid: string, consentId: string, payloadText: string) {
  const db = getDb();
  const [c] = await db
    .select()
    .from(s.consentRecords)
    .where(and(eq(s.consentRecords.id, consentId), eq(s.consentRecords.userId, uid)));
  if (!c || c.revokedAt) return { ok: false as const, reason: "Consent not found" };
  if (c.payloadSha256 !== sha256(payloadText)) return { ok: false as const, reason: "Payload differs from what was consented" };
  if (Date.now() - c.grantedAt.getTime() > CONSENT_TTL_MS) return { ok: false as const, reason: "Consent expired" };
  return { ok: true as const, consent: c };
}

export async function saveResearch(
  uid: string,
  input: {
    consentId: string;
    payloadText: string;
    decisionId: string | null;
    resultText: string;
    webSearchQueries: string[];
    searchEntryPointHtml: string | null;
    sources: { uri: string; title: string | null; domain: string | null }[];
    findings: { text: string; chunk_indices: number[] }[];
  },
) {
  const db = getDb();
  if (input.decisionId) {
    const [own] = await db
      .select({ id: s.decisionRecords.id })
      .from(s.decisionRecords)
      .where(and(eq(s.decisionRecords.id, input.decisionId), eq(s.decisionRecords.userId, uid)));
    if (!own) input.decisionId = null;
  }
  return db.transaction(async (tx) => {
    const [session] = await tx
      .insert(s.researchSessions)
      .values({
        userId: uid,
        decisionId: input.decisionId,
        consentId: input.consentId,
        queryText: input.payloadText,
        status: input.sources.length ? "completed" : "insufficient",
        webSearchQueries: input.webSearchQueries,
        searchEntryPointHtml: input.searchEntryPointHtml,
        resultText: input.resultText,
      })
      .returning({ id: s.researchSessions.id });
    if (input.sources.length) {
      await tx.insert(s.researchSources).values(
        input.sources.map((src, i) => ({ sessionId: session.id, userId: uid, uri: src.uri, title: src.title, domain: src.domain, chunkIndex: i })),
      );
    }
    if (input.findings.length) {
      await tx.insert(s.researchFindings).values(
        input.findings.map((f) => ({
          sessionId: session.id,
          userId: uid,
          findingText: f.text,
          sourceChunkIndices: f.chunk_indices,
          grounded: f.chunk_indices.length > 0,
        })),
      );
    }
    return session.id;
  });
}

export async function listResearch(uid: string) {
  const db = getDb();
  return db
    .select({ id: s.researchSessions.id, queryText: s.researchSessions.queryText, status: s.researchSessions.status, createdAt: s.researchSessions.createdAt })
    .from(s.researchSessions)
    .where(eq(s.researchSessions.userId, uid))
    .orderBy(desc(s.researchSessions.createdAt))
    .limit(20);
}

export async function listConsents(uid: string) {
  const db = getDb();
  return db
    .select({ id: s.consentRecords.id, scope: s.consentRecords.scope, purpose: s.consentRecords.purpose, service: s.consentRecords.service, grantedAt: s.consentRecords.grantedAt, payloadText: s.consentRecords.payloadText })
    .from(s.consentRecords)
    .where(eq(s.consentRecords.userId, uid))
    .orderBy(desc(s.consentRecords.grantedAt))
    .limit(50);
}

// ───────────── stats (real counts only) ─────────────

export async function stats(uid: string) {
  const db = getDb();
  const now = new Date();
  const [total, byStatus, awaiting, outcomes, byCategory, upcoming, research] = await Promise.all([
    db.select({ n: count() }).from(s.decisionRecords).where(eq(s.decisionRecords.userId, uid)),
    db.select({ status: s.decisionRecords.status, n: count() }).from(s.decisionRecords).where(eq(s.decisionRecords.userId, uid)).groupBy(s.decisionRecords.status),
    db
      .select({ n: count() })
      .from(s.decisionRecords)
      .where(and(eq(s.decisionRecords.userId, uid), eq(s.decisionRecords.status, "decided"), lte(s.decisionRecords.reviewDueAt, now))),
    db.select({ status: s.decisionOutcomes.outcomeStatus, n: count() }).from(s.decisionOutcomes).where(eq(s.decisionOutcomes.userId, uid)).groupBy(s.decisionOutcomes.outcomeStatus),
    db.select({ category: s.decisionRecords.category, n: count() }).from(s.decisionRecords).where(eq(s.decisionRecords.userId, uid)).groupBy(s.decisionRecords.category),
    db
      .select({ id: s.decisionRecords.id, title: s.decisionRecords.title, reviewDueAt: s.decisionRecords.reviewDueAt })
      .from(s.decisionRecords)
      .where(and(eq(s.decisionRecords.userId, uid), eq(s.decisionRecords.status, "decided")))
      .orderBy(asc(s.decisionRecords.reviewDueAt))
      .limit(5),
    db.select({ n: count() }).from(s.researchSessions).where(eq(s.researchSessions.userId, uid)),
  ]);
  return {
    total: total[0]?.n ?? 0,
    byStatus,
    awaitingReview: awaiting[0]?.n ?? 0,
    outcomes,
    byCategory,
    upcoming,
    researchSessions: research[0]?.n ?? 0,
  };
}

export async function logAi(uid: string, e: { task: string; inferenceSource: "ON_DEVICE" | "IN_CLOUD" | null; success: boolean; errorCode?: string; latencyMs: number }) {
  await getDb().insert(s.aiProcessingLogs).values({ userId: uid, ...e });
}

// ───────────── saved online references (personal, unverified) ─────────────

export async function listWebReferences(uid: string) {
  const db = getDb();
  return db.select().from(s.webReferences).where(eq(s.webReferences.userId, uid)).orderBy(desc(s.webReferences.savedAt)).limit(100);
}

export async function saveWebReference(
  uid: string,
  ref: { url: string; title: string; snippet: string; publisher: string; query: string },
) {
  const db = getDb();
  const [row] = await db
    .insert(s.webReferences)
    .values({ userId: uid, url: ref.url, title: ref.title, snippet: ref.snippet, publisher: ref.publisher, queryText: ref.query })
    .onConflictDoNothing()
    .returning({ id: s.webReferences.id });
  return row?.id ?? null; // null: the user had already saved this URL
}

export async function deleteWebReference(uid: string, id: string) {
  const db = getDb();
  const rows = await db
    .delete(s.webReferences)
    .where(and(eq(s.webReferences.id, id), eq(s.webReferences.userId, uid)))
    .returning({ id: s.webReferences.id });
  return rows.length > 0;
}
