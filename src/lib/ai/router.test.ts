import { describe, expect, it } from "vitest";
import { mayUseCloud, routeFor, RoutingError, type AiTask } from "./router";

const tasks: AiTask[] = ["extract", "generalize", "summarize"];

describe("routeFor", () => {
  it("Private mode can never reach the cloud", () => {
    for (const t of tasks) {
      expect(mayUseCloud(routeFor(t, { privacyMode: "private" }))).toBe(false);
    }
    expect(() => routeFor("research", { privacyMode: "private", consentId: "x" })).toThrow(RoutingError);
  });

  it("query generalization is on-device in every mode", () => {
    for (const m of ["private", "hybrid", "cloud_research"] as const) {
      expect(routeFor("generalize", { privacyMode: m })).toBe("only_on_device");
    }
  });

  it("Hybrid mode allows cloud fallback for structuring but not research", () => {
    expect(routeFor("extract", { privacyMode: "hybrid" })).toBe("prefer_on_device");
    expect(() => routeFor("research", { privacyMode: "hybrid", consentId: "x" })).toThrow(/Cloud Research mode/);
  });

  it("research requires a consent id", () => {
    expect(() => routeFor("research", { privacyMode: "cloud_research" })).toThrow(/consent/);
    expect(routeFor("research", { privacyMode: "cloud_research", consentId: "c1" })).toBe("only_in_cloud");
  });
});
