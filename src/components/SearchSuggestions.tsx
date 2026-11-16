"use client";
import { useEffect, useRef } from "react";
import { useLanguage } from "@/lib/i18n";

/**
 * Renders Google's required "Search suggestions" (searchEntryPoint.renderedContent)
 * inside a shadow root, as the Firebase AI Logic SDK recommends, so its CSS
 * can't clash with ours. Displaying it is a Grounding with Google Search requirement.
 */
export function SearchSuggestions({ html }: { html: string | null | undefined }) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host || !html) return;
    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    root.innerHTML = html;
  }, [html]);
  if (!html) return null;
  return <div ref={ref} aria-label={t("Google Search suggestions")} />;
}
