/**
 * The single place that decides WHERE an AI task may run (spec K / L).
 *
 * Why this exists: in PREFER_ON_DEVICE mode the Firebase AI Logic SDK silently
 * sends requests to the cloud whenever the on-device model is unavailable or
 * the request is unsupported. So a cloud-capable model must never be built
 * unless the user's privacy mode allows it.
 *
 * Pure module (no SDK import) so it can be unit-tested.
 */
import type { PrivacyMode } from "../vocab";

export type AiTask =
  | "extract" // free text → structured decision
  | "generalize" // private decision → minimised research query
  | "summarize" // phrase similarities/differences, lessons, reflection questions
  | "research"; // grounded web research

/** Mirrors firebase/ai InferenceMode string values. */
export type Route = "only_on_device" | "prefer_on_device" | "only_in_cloud";

export class RoutingError extends Error {
  constructor(
    message: string,
    readonly code: "research_needs_cloud_mode" | "research_needs_consent",
  ) {
    super(message);
    this.name = "RoutingError";
  }
}

export interface RouteContext {
  privacyMode: PrivacyMode;
  /** Server-issued consent record id for this exact research payload. */
  consentId?: string | null;
}

export function routeFor(task: AiTask, ctx: RouteContext): Route {
  switch (task) {
    case "generalize":
      // The input IS the private text. Cloud fallback would defeat the purpose,
      // so this task is on-device only in every mode.
      return "only_on_device";

    case "extract":
    case "summarize":
      return ctx.privacyMode === "private" ? "only_on_device" : "prefer_on_device";

    case "research":
      if (ctx.privacyMode !== "cloud_research") {
        throw new RoutingError(
          "Live research needs Cloud Research mode. Change it in Settings.",
          "research_needs_cloud_mode",
        );
      }
      if (!ctx.consentId) {
        throw new RoutingError(
          "Live research needs your explicit consent for this query.",
          "research_needs_consent",
        );
      }
      return "only_in_cloud";
  }
}

/** True if the route could transmit the prompt to a cloud model. */
export function mayUseCloud(route: Route): boolean {
  return route !== "only_on_device";
}
