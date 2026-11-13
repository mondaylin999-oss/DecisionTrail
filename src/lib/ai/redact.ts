/**
 * Deterministic leak check that runs AFTER on-device query generalization.
 * Gemini Nano is not trusted alone: anything that looks private and also
 * appears in the outgoing query is flagged for the user to review.
 */

export interface LeakFlag {
  kind: "email" | "url" | "phone" | "money" | "number" | "proper_noun";
  text: string;
}

const COMMON_CAPITALISED = new Set([
  "I", "A", "The", "Should", "We", "My", "Our", "It", "If", "In", "On", "Or", "And", "But",
  "SaaS", "B2B", "B2C", "API", "AI", "SQL", "Postgres", "PostgreSQL", "MongoDB", "MySQL",
  "AWS", "Google", "Firebase", "Stripe", "Chrome", "Next", "React", "Node",
]);

const PATTERNS: { kind: LeakFlag["kind"]; re: RegExp }[] = [
  { kind: "email", re: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  { kind: "url", re: /\bhttps?:\/\/\S+|\bwww\.\S+/gi },
  { kind: "phone", re: /\+?\d[\d\s().-]{7,}\d/g },
  { kind: "money", re: /(?:[$€£¥₹]|\b(?:usd|eur|mmk|ks|kyat)s?\b)\s?\d[\d,.]*\s?[km]?|\b\d[\d,.]*\s?(?:usd|eur|mmk|kyats?|dollars?)\b/gi },
];

/** Capitalised words in the private text that are likely names (people, companies, places). */
export function properNounsIn(privateText: string): string[] {
  const out = new Set<string>();
  const sentences = privateText.split(/(?<=[.!?\n])\s+/);
  for (const s of sentences) {
    const words = s.split(/\s+/);
    words.forEach((w, i) => {
      const clean = w.replace(/[^\p{L}\p{N}'-]/gu, "");
      if (i === 0 || clean.length < 3) return; // sentence-initial capitals are ambiguous
      if (/^\p{Lu}/u.test(clean) && !COMMON_CAPITALISED.has(clean)) out.add(clean);
    });
  }
  return [...out];
}

/** Numbers of 3+ digits in the private text (revenue, user counts, prices…). */
function significantNumbers(privateText: string): string[] {
  return [...new Set(privateText.match(/\b\d[\d,.]{2,}\b/g) ?? [])];
}

export function findLeaks(privateText: string, outgoingQuery: string): LeakFlag[] {
  const flags: LeakFlag[] = [];
  const q = outgoingQuery;

  for (const { kind, re } of PATTERNS) {
    for (const m of q.matchAll(re)) flags.push({ kind, text: m[0].trim() });
  }
  for (const n of significantNumbers(privateText)) {
    if (q.includes(n)) flags.push({ kind: "number", text: n });
  }
  const qLower = q.toLowerCase();
  for (const noun of properNounsIn(privateText)) {
    const re = new RegExp(`\\b${noun.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").toLowerCase()}\\b`);
    if (re.test(qLower)) flags.push({ kind: "proper_noun", text: noun });
  }

  const seen = new Set<string>();
  return flags.filter((f) => {
    const k = `${f.kind}:${f.text.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
