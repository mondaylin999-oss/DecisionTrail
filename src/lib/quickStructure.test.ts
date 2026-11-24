import { describe, expect, it } from "vitest";
import { optionsIn, quickStructure, tagFor } from "./quickStructure";

describe("quickStructure", () => {
  it("reads a pricing question", () => {
    const d = quickStructure("I run a B2B SaaS for small clinics with a small team and a limited budget. Should we offer a free plan or a paid subscription?", []);
    expect(d.category).toBe("pricing");
    expect(d.decision_type).toBe("choose_one");
    expect(d.alternatives.map((a) => [a.label, a.tag])).toEqual([["Free plan", "free_plan"], ["Paid subscription", "paid_subscription"]]);
    expect(d.constraints).toEqual(["budget_limited", "small_team"]);
    expect(d.facets.customer_segment).toBe("b2b");
    expect(d.title).toBe("Should we offer a free plan or a paid subscription?");
  });

  it("prefers options the user typed", () => {
    const d = quickStructure("How should we design our backend?", ["Monolith", " Microservices ", ""]);
    expect(d.alternatives.map((a) => a.tag)).toEqual(["monolith", "microservices"]);
    expect(d.category).toBe("technology");
  });

  it("treats a question without options as yes or no", () => {
    const d = quickStructure("Should we raise our prices?", []);
    expect(d.decision_type).toBe("yes_no");
    expect(d.alternatives.map((a) => [a.label, a.tag])).toEqual([["Yes", "price_increase"], ["No", "other"]]);
  });

  it("does not guess when nothing matches", () => {
    const d = quickStructure("Blue curtains in the kitchen", []);
    expect(d.category).toBe("other");
    expect(d.facets).toEqual({ customer_segment: "unknown", company_stage: "unknown" });
  });

  it("ignores long prose that merely contains 'or'", () => {
    expect(optionsIn("We have been thinking about this for a very long time and cannot say whether it would be a sensible thing to do this year or perhaps something we should revisit with the whole team later")).toBeNull();
  });

  it("tags options", () => {
    expect(tagFor("Raise prices")).toBe("price_increase");
    expect(tagFor("Freemium")).toBe("freemium");
    expect(tagFor("Something else")).toBe("other");
  });
});
