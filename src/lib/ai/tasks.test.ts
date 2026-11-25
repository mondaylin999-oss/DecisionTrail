/**
 * Firebase AI Logic ignores ONLY_ON_DEVICE when the browser has no `LanguageModel`
 * and calls the cloud instead. These tests run our real task code against a fake SDK
 * that behaves the same way, and fail if a prompt reaches it when it must not.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ calls: [] as string[], reply: "{}", source: undefined as string | undefined }));

vi.mock("firebase/ai", () => ({
  AIError: class AIError extends Error {},
  InferenceMode: { ONLY_ON_DEVICE: "only_on_device", PREFER_ON_DEVICE: "prefer_on_device", ONLY_IN_CLOUD: "only_in_cloud" },
  InferenceSource: { ON_DEVICE: "on_device", IN_CLOUD: "in_cloud" },
  getGenerativeModel: (_ai: unknown, p: { mode: string }) => ({
    generateContent: async (prompt: string) => {
      sdk.calls.push(prompt);
      const hasDevice = "LanguageModel" in globalThis;
      const source = sdk.source ?? (hasDevice && p.mode !== "only_in_cloud" ? "on_device" : "in_cloud");
      return { response: { text: () => sdk.reply, inferenceSource: source, candidates: [] } };
    },
  }),
}));
vi.mock("../firebase/client", () => ({ CLOUD_MODEL: "m", RESEARCH_MODEL: "m", firebaseAI: () => ({}) }));
vi.mock("../api", () => ({ api: async () => ({}) }));

const { explainEvidence, extractDecision, generalizeQuery } = await import("./tasks");

const SECRET = "My employer Acme pays me 5000";
const items = [{ title: "T", answer: "Students reported confidence." }, { title: "U", answer: "More." }];
const device = (status: string) => vi.stubGlobal("LanguageModel", { availability: async () => status });

beforeEach(() => {
  sdk.calls.length = 0;
  sdk.source = undefined;
  vi.stubGlobal("window", globalThis);
});
afterEach(() => vi.unstubAllGlobals());

describe("on-device-only tasks never send a prompt when on-device AI isn't ready", () => {
  const setups: [string, () => void][] = [
    ["no on-device AI in the browser", () => {}],
    ["model unavailable", () => device("unavailable")],
    ["model not downloaded", () => device("downloadable")],
  ];
  for (const [name, setup] of setups)
    it(name, async () => {
      setup();
      await expect(generalizeQuery(SECRET)).rejects.toThrow(/on-device/i);
      await expect(extractDecision(SECRET, "private")).rejects.toThrow(/on-device/i);
      await expect(explainEvidence(SECRET, items, "private")).rejects.toThrow(/on-device/i);
      expect(sdk.calls).toEqual([]);
    });
});

describe("when on-device AI is ready", () => {
  it("runs and reports the device", async () => {
    device("available");
    sdk.reply = JSON.stringify({ query: "What happened to students after internships?", removed: ["name"] });
    expect((await generalizeQuery(SECRET)).where).toBe("ON_DEVICE");
  });

  it("rejects a result that says it ran in the cloud, without retrying", async () => {
    device("available");
    sdk.source = "in_cloud";
    sdk.reply = JSON.stringify({ query: "What happened to students after internships?", removed: [] });
    await expect(generalizeQuery(SECRET)).rejects.toThrow(/cloud/i);
    expect(sdk.calls).toHaveLength(1);
  });
});

describe("Hybrid mode", () => {
  it("may use the cloud and says so", async () => {
    sdk.reply = JSON.stringify({ points: [{ text: "Students reported confidence.", sources: [1] }], limits: "" });
    expect((await explainEvidence("Should I?", items, "hybrid")).where).toBe("IN_CLOUD");
  });
});
