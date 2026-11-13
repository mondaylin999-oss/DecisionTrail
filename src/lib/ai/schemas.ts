/**
 * Output contracts for AI tasks. The same JSON Schema is given to the
 * on-device model (Prompt API `responseConstraint`) and the cloud model
 * (`responseJsonSchema`), and every response is validated with Zod.
 * Keep schemas small and flat: Gemini Nano is far more reliable that way.
 */
import { z } from "zod";
import {
  ALTERNATIVE_TAGS,
  CATEGORIES,
  COMPANY_STAGES,
  CONSTRAINT_TAGS,
  CUSTOMER_SEGMENTS,
  DECISION_TYPES,
  TIME_HORIZONS,
} from "../vocab";

export const ExtractionZ = z.object({
  title: z.string().min(1).max(160),
  category: z.enum(CATEGORIES),
  decision_type: z.enum(DECISION_TYPES),
  context: z.string().max(2000),
  objective: z.string().max(600),
  time_horizon: z.enum(TIME_HORIZONS),
  alternatives: z
    .array(
      z.object({
        label: z.string().min(1).max(120),
        description: z.string().max(400),
        tag: z.enum(ALTERNATIVE_TAGS),
      }),
    )
    .max(6),
  constraints: z.array(z.enum(CONSTRAINT_TAGS)).max(7),
  assumptions: z.array(z.string().max(300)).max(8),
  expected_benefits: z.array(z.string().max(300)).max(6),
  risks: z.array(z.string().max(300)).max(6),
  missing_information: z.array(z.string().max(200)).max(6),
  customer_segment: z.enum(CUSTOMER_SEGMENTS),
  company_stage: z.enum(COMPANY_STAGES),
});
export type Extraction = z.infer<typeof ExtractionZ>;

const str = { type: "string" } as const;
const strArr = { type: "array", items: str } as const;
const enumOf = (values: readonly string[]) => ({ type: "string", enum: [...values] });

export const extractionJsonSchema = {
  type: "object",
  properties: {
    title: str,
    category: enumOf(CATEGORIES),
    decision_type: enumOf(DECISION_TYPES),
    context: str,
    objective: str,
    time_horizon: enumOf(TIME_HORIZONS),
    alternatives: {
      type: "array",
      items: {
        type: "object",
        properties: { label: str, description: str, tag: enumOf(ALTERNATIVE_TAGS) },
        required: ["label", "description", "tag"],
      },
    },
    constraints: { type: "array", items: enumOf(CONSTRAINT_TAGS) },
    assumptions: strArr,
    expected_benefits: strArr,
    risks: strArr,
    missing_information: strArr,
    customer_segment: enumOf(CUSTOMER_SEGMENTS),
    company_stage: enumOf(COMPANY_STAGES),
  },
  required: [
    "title", "category", "decision_type", "context", "objective", "time_horizon",
    "alternatives", "constraints", "assumptions", "expected_benefits", "risks",
    "missing_information", "customer_segment", "company_stage",
  ],
} as const;

export const EXTRACTION_SYSTEM_PROMPT = `You structure a person's decision into JSON. Rules:
- Use only information in the user's text. Do not invent facts, numbers or names.
- "assumptions" are beliefs the decision depends on that are NOT yet verified. Phrase each as a short statement.
- "missing_information" lists facts that would help the decision but were not given.
- Pick the closest enum value. Use "other" or "unknown" when nothing fits.
- Keep "context" to a faithful 1-3 sentence summary.`;

export const GeneralizationZ = z.object({
  query: z.string().min(10).max(600),
  removed: z.array(z.string().max(120)).max(12),
});
export type Generalization = z.infer<typeof GeneralizationZ>;

export const generalizationJsonSchema = {
  type: "object",
  properties: { query: str, removed: strArr },
  required: ["query", "removed"],
} as const;

export const GENERALIZATION_SYSTEM_PROMPT = `You turn a private decision into a GENERAL web research request.
- Remove every name of a person, company, product, customer or place.
- Remove all specific numbers (prices, revenue, user counts, dates) and replace them with general descriptions such as "small", "early-stage" or "limited budget".
- Remove confidential details and anything personal.
- Ask for documented decisions by companies or teams in similar situations, and what happened afterwards.
- "removed" lists the kinds of details you removed (e.g. "company name", "price"), not the values themselves.`;

/** Parse model text that should be JSON (tolerates ```json fences). */
export function parseJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}
