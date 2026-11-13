"use client";
/**
 * Reports whether Chrome's built-in Gemini Nano (Prompt API) can run here.
 * Firebase AI Logic uses the same API under the hood; we query it directly
 * only to show the user an accurate status before they click anything.
 */

export type DeviceAiStatus =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable"
  | "unsupported_browser";

interface LanguageModelStatic {
  availability(options?: unknown): Promise<"available" | "downloadable" | "downloading" | "unavailable">;
}

export const ON_DEVICE_CREATE_OPTIONS = {
  expectedInputs: [{ type: "text" as const, languages: ["en"] }],
  expectedOutputs: [{ type: "text" as const, languages: ["en"] }],
};

export async function deviceAiStatus(): Promise<DeviceAiStatus> {
  if (typeof window === "undefined") return "unsupported_browser";
  const LM = (globalThis as unknown as { LanguageModel?: LanguageModelStatic }).LanguageModel;
  if (!LM?.availability) return "unsupported_browser";
  try {
    return await LM.availability(ON_DEVICE_CREATE_OPTIONS);
  } catch {
    return "unavailable";
  }
}

export const STATUS_TEXT: Record<DeviceAiStatus, string> = {
  available: "Private AI ready",
  downloadable: "Private AI can be downloaded",
  downloading: "Private AI downloading…",
  unavailable: "Private AI unavailable on this device",
  unsupported_browser: "Private AI needs desktop Chrome",
};
