import { describe, expect, it } from "vitest";
import { findLeaks, properNounsIn } from "./redact";

const privateText =
  "I'm building ClinicFlow for small clinics in Yangon. We charge $49 per month and have 1,200 users. Email me at mai@clinicflow.io.";

describe("findLeaks", () => {
  it("flags names, amounts, counts and emails that survive generalization", () => {
    const leaky = "Free plan vs paid subscription for ClinicFlow in Yangon at $49 with 1,200 users, contact mai@clinicflow.io";
    const kinds = findLeaks(privateText, leaky).map((f) => f.kind);
    expect(kinds).toEqual(expect.arrayContaining(["proper_noun", "money", "number", "email"]));
  });

  it("passes a properly generalized query", () => {
    const safe =
      "Find documented experiences of small B2B SaaS companies choosing between a free plan and a paid subscription, and what happened afterwards.";
    expect(findLeaks(privateText, safe)).toEqual([]);
  });
});

describe("properNounsIn", () => {
  it("skips sentence-initial words and common tech names", () => {
    expect(properNounsIn("Should we use Postgres? We met Aung at Acme.")).toEqual(["Aung", "Acme"]);
  });
});
