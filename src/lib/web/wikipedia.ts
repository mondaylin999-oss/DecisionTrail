/**
 * Pure helpers for the live online lookup (no network, no server-only imports,
 * so they are easy to unit test). The only source is Wikipedia's public search
 * API: keyless, free, and its text is CC BY-SA 4.0 (we show a snippet and link back).
 */

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
  publisher: string;
}

const ENTITIES: Record<string, string> = {
  "&quot;": '"',
  "&#039;": "'",
  "&#39;": "'",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
};

/** Wikipedia search snippets contain <span class="searchmatch"> and entities. Return plain text. */
export function cleanSnippet(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(quot|#0?39|amp|lt|gt|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

export function wikiUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

export function searchApiUrl(query: string, limit = 8): string {
  const p = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: String(limit),
    srprop: "snippet",
    format: "json",
  });
  return `https://en.wikipedia.org/w/api.php?${p.toString()}`;
}

export function parseSearch(json: unknown): WebResult[] {
  const rows = (json as { query?: { search?: unknown } } | null)?.query?.search;
  if (!Array.isArray(rows)) return [];
  const out: WebResult[] = [];
  for (const r of rows) {
    const row = r as { title?: unknown; snippet?: unknown };
    if (typeof row.title !== "string" || !row.title) continue;
    out.push({
      title: row.title,
      url: wikiUrl(row.title),
      snippet: typeof row.snippet === "string" ? cleanSnippet(row.snippet) : "",
      publisher: "Wikipedia",
    });
  }
  return out;
}

/** Saved references may only point at https Wikipedia pages (the one source we fetch from). */
export function isAllowedReferenceUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "wikipedia.org" || u.hostname.endsWith(".wikipedia.org"));
  } catch {
    return false;
  }
}
