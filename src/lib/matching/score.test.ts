import { describe, expect, it } from "vitest";
import { assessSufficiency, jaccard, scoreCandidate, toOrTsQuery, type Candidate, type MatchAttributes } from "./score";

const query: MatchAttributes = {
  category: "pricing",
  decisionType: "choose_one",
  alternativeTags: ["free_plan", "paid_subscription", "one_time_purchase"],
  constraintTags: ["budget_limited", "small_team"],
  facets: { customer_segment: "b2b", company_stage: "pre_revenue" },
  year: 2026,
};

const base: Candidate = {
  ...query,
  textRank: 0.5,
};

describe("jaccard", () => {
  it("ignores 'other' and handles empty sets", () => {
    expect(jaccard([], [])).toBe(0);
    expect(jaccard(["other"], ["other"])).toBe(0);
    expect(jaccard(["a", "b"], ["b", "c"])).toBeCloseTo(1 / 3);
  });
});

describe("scoreCandidate", () => {
  it("labels a near-identical case as strong", () => {
    const r = scoreCandidate(query, base);
    expect(r.label).toBe("strong");
    expect(r.explanation.similarities.length).toBeGreaterThan(0);
  });

  it("never labels a different decision type as strong", () => {
    const r = scoreCandidate(query, { ...base, decisionType: "yes_no" });
    expect(r.label).not.toBe("strong");
  });

  it("downgrades strong to partial on a large scale gap", () => {
    const r = scoreCandidate(query, {
      ...base,
      facets: { customer_segment: "b2b", company_stage: "enterprise" },
    });
    expect(r.label).toBe("partial");
    expect(r.explanation.differences.join(" ")).toMatch(/scale/i);
  });

  it("hides unrelated cases", () => {
    const r = scoreCandidate(query, {
      category: "technology",
      decisionType: "yes_no",
      alternativeTags: ["monolith", "microservices"],
      constraintTags: [],
      facets: { customer_segment: "b2c", company_stage: "growth" },
      textRank: 0,
    });
    expect(r.label).toBeNull();
  });

  it("records undocumented alternatives as unknown, not as a difference", () => {
    const r = scoreCandidate(query, { ...base, alternativeTags: [] });
    expect(r.explanation.unknowns.join(" ")).toMatch(/not documented/);
  });
});

describe("assessSufficiency", () => {
  it("requires outcome-known strong matches", () => {
    expect(assessSufficiency([{ label: "strong", outcomeKnown: false }, { label: "strong", outcomeKnown: false }])).toBe("insufficient");
    expect(assessSufficiency([{ label: "strong", outcomeKnown: true }, { label: "strong", outcomeKnown: true }])).toBe("sufficient");
    expect(assessSufficiency([{ label: "partial", outcomeKnown: true }, { label: "partial", outcomeKnown: false }])).toBe("partial");
    expect(assessSufficiency([])).toBe("insufficient");
  });
});

describe("toOrTsQuery", () => {
  it("strips operators and stop words", () => {
    expect(toOrTsQuery("Should I use Postgres & MongoDB? !(x) | y")).toBe("postgres | mongodb");
    expect(toOrTsQuery("!!")).toBeNull();
  });
});
