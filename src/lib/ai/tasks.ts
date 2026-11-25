"use client";
/**
 * Every generative AI call in DecisionTrail goes through this file, and
 * every model is built from a route chosen by `routeFor()`.
 */
import {
  AIError,
  getGenerativeModel,
  InferenceMode,
  InferenceSource,
  type GenerativeModel,
  type GroundingMetadata,
  type HybridParams,
} from "firebase/ai";
import { CLOUD_MODEL, firebaseAI, RESEARCH_MODEL } from "../firebase/client";
import type { PrivacyMode } from "../vocab";
import { deviceAiStatus, ON_DEVICE_CREATE_OPTIONS } from "./availability";
import { BRIEF_SYSTEM_PROMPT, BriefZ, briefJsonSchema, briefPrompt, cleanBrief, type Brief, type EvidenceItem } from "./brief";
import { assertMayStart, assertRanAllowed, routeFor, RoutingError, type AiTask, type Route } from "./router";
import {
  EXTRACTION_SYSTEM_PROMPT,
  ExtractionZ,
  extractionJsonSchema,
  GENERALIZATION_SYSTEM_PROMPT,
  GeneralizationZ,
  generalizationJsonSchema,
  parseJson,
  type Extraction,
  type Generalization,
} from "./schemas";
import { api } from "../api";

export type Where = "ON_DEVICE" | "IN_CLOUD";

export interface AiResult<T> {
  data: T;
  where: Where;
}

const MODE: Record<Route, HybridParams["mode"]> = {
  only_on_device: InferenceMode.ONLY_ON_DEVICE,
  prefer_on_device: InferenceMode.PREFER_ON_DEVICE,
  only_in_cloud: InferenceMode.ONLY_IN_CLOUD,
};

function buildModel(route: Route, opts: {
  system: string;
  jsonSchema?: object;
  tools?: NonNullable<HybridParams["inCloudParams"]>["tools"];
  cloudModel?: string;
}): GenerativeModel {
  return getGenerativeModel(firebaseAI(), {
    mode: MODE[route],
    onDeviceParams: {
      createOptions: {
        ...ON_DEVICE_CREATE_OPTIONS,
        initialPrompts: [{ role: "system", content: [{ type: "text", value: opts.system }] }],
      },
      promptOptions: opts.jsonSchema ? { responseConstraint: opts.jsonSchema } : undefined,
    },
    inCloudParams: {
      model: opts.cloudModel ?? CLOUD_MODEL,
      systemInstruction: opts.system,
      tools: opts.tools,
      generationConfig: opts.jsonSchema
        ? { responseMimeType: "application/json", responseJsonSchema: opts.jsonSchema as Record<string, unknown> }
        : undefined,
    },
  });
}

function where(src: string | undefined): Where {
  return src === InferenceSource.ON_DEVICE ? "ON_DEVICE" : "IN_CLOUD";
}

/** Minimal, text-free processing log (spec M: ai_processing_logs). */
function log(task: AiTask, w: Where | null, ok: boolean, started: number, errorCode?: string) {
  void api("/api/ai-log", {
    method: "POST",
    body: { task, inferenceSource: w, success: ok, errorCode, latencyMs: Math.round(performance.now() - started) },
  }).catch(() => {});
}

/**
 * Must be called from a click handler: Chrome only allows the model
 * download after a user gesture.
 */
export async function prepareDeviceModel(onProgress?: (p: number) => void): Promise<void> {
  const model = buildModel("only_on_device", { system: EXTRACTION_SYSTEM_PROMPT });
  await model.initializeDeviceModel(onProgress);
}

async function structured<T>(
  task: AiTask,
  privacyMode: PrivacyMode,
  system: string,
  schema: object,
  prompt: string,
  validate: (v: unknown) => T,
): Promise<AiResult<T>> {
  const route = routeFor(task, { privacyMode });
  const started = performance.now();
  if (route === "only_on_device") {
    try {
      assertMayStart(route, await deviceAiStatus());
    } catch (e) {
      log(task, null, false, started, "device_ai_not_ready");
      throw e;
    }
  }
  const model = buildModel(route, { system, jsonSchema: schema });
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await model.generateContent(
        attempt === 0 ? prompt : `${prompt}\n\nReturn ONLY valid JSON matching the schema.`,
      );
      const w = where(res.response.inferenceSource);
      assertRanAllowed(route, w);
      const data = validate(parseJson(res.response.text()));
      log(task, w, true, started);
      return { data, where: w };
    } catch (e) {
      lastError = e;
      if (e instanceof AIError || e instanceof RoutingError) break; // availability / transport errors: don't retry
    }
  }
  log(task, null, false, started, lastError instanceof AIError ? String(lastError.code) : "invalid_output");
  throw lastError;
}

export function extractDecision(text: string, privacyMode: PrivacyMode): Promise<AiResult<Extraction>> {
  return structured(
    "extract",
    privacyMode,
    EXTRACTION_SYSTEM_PROMPT,
    extractionJsonSchema,
    `Decision description:\n"""${text.slice(0, 6000)}"""`,
    (v) => ExtractionZ.parse(v),
  );
}

export function generalizeQuery(privateSummary: string): Promise<AiResult<Generalization>> {
  // Privacy mode is irrelevant here: generalization is always on-device.
  return structured(
    "generalize",
    "private",
    GENERALIZATION_SYSTEM_PROMPT,
    generalizationJsonSchema,
    `Private decision:\n"""${privateSummary.slice(0, 4000)}"""`,
    (v) => GeneralizationZ.parse(v),
  );
}

/** Explains numbered evidence. Unsupported, advising or predicting points are removed before display. */
export function explainEvidence(question: string, items: EvidenceItem[], privacyMode: PrivacyMode): Promise<AiResult<Brief>> {
  return structured("summarize", privacyMode, BRIEF_SYSTEM_PROMPT, briefJsonSchema, briefPrompt(question, items), (v) => cleanBrief(BriefZ.parse(v), items));
}

/** A short, safe message for a failed cloud call. Raw SDK errors contain URLs and project details. */
export function cloudErrorText(e: unknown): string {
  if (e instanceof RoutingError) return e.message;
  const m = e instanceof Error ? e.message : String(e);
  if (/\b429\b|quota|rate.?limit/i.test(m)) return "Google's free limit for this kind of request is used up for now. Try again later. The evidence above doesn't use it.";
  if (/\b(401|403)\b|app.?check/i.test(m)) return "Google didn't accept the request from this site.";
  if (/\b5\d\d\b|overloaded|unavailable/i.test(m)) return "Google's AI is busy. Try again in a moment.";
  return "The AI request failed. Try again.";
}

export interface ResearchResult {
  text: string;
  grounding: GroundingMetadata | null;
  where: Where;
}

const RESEARCH_SYSTEM = `You research documented historical decisions.
- Prefer primary sources: official company announcements, engineering blogs, filings, documentation.
- For each relevant case give: who decided, what they decided, when, and what was observed afterwards, with its date if stated.
- Say clearly when an outcome is not documented. Never guess outcomes, dates or numbers.
- Separate (1) documented precedents, (2) supporting research, (3) opinions or personal experiences.
- Do not claim causation unless a source states it.`;

export async function runResearch(
  query: string,
  privacyMode: PrivacyMode,
  consentId: string,
): Promise<ResearchResult> {
  const route = routeFor("research", { privacyMode, consentId });
  const model = buildModel(route, {
    system: RESEARCH_SYSTEM,
    tools: [{ googleSearch: {} }],
    cloudModel: RESEARCH_MODEL,
  });
  const started = performance.now();
  try {
    const res = await model.generateContent(query);
    const grounding = res.response.candidates?.[0]?.groundingMetadata ?? null;
    const w = where(res.response.inferenceSource);
    log("research", w, true, started);
    return { text: res.response.text(), grounding, where: w };
  } catch (e) {
    log("research", null, false, started, e instanceof AIError ? String(e.code) : "error");
    throw e;
  }
}
