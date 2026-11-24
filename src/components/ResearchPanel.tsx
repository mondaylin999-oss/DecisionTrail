"use client";
/**
 * Live research with explicit consent (spec H):
 * on-device generalization → deterministic leak check → user edits →
 * consent sheet → cloud Gemini + Google Search grounding → research candidates.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import type { GroundingMetadata } from "firebase/ai";
import { findLeaks } from "@/lib/ai/redact";
import { RoutingError } from "@/lib/ai/router";
import { generalizeQuery, runResearch, type Where } from "@/lib/ai/tasks";
import { api } from "@/lib/api";
import { RESEARCH_MODEL } from "@/lib/firebase/client";
import type { StructuredDecision } from "@/lib/types";
import { label, type PrivacyMode } from "@/lib/vocab";
import { InferenceBadge } from "./marks";
import { SearchSuggestions } from "./SearchSuggestions";
import { Badge, Button, Card, CardTitle, Notice, Spinner, Textarea } from "./ui";

type Phase = "idle" | "generalizing" | "review" | "running" | "done" | "declined";

interface Source {
  uri: string;
  title: string | null;
  domain: string | null;
}
interface Finding {
  text: string;
  chunk_indices: number[];
}

/** Deterministic fallback when Gemini Nano isn't available: built only from enum fields. */
export function templateQuery(d: StructuredDecision): string {
  const opts = d.alternatives.map((a) => label(a.tag).toLowerCase()).filter((t) => t !== "other");
  const stage = d.facets.company_stage && d.facets.company_stage !== "unknown" ? `${label(d.facets.company_stage).toLowerCase()} ` : "";
  const seg = d.facets.customer_segment && d.facets.customer_segment !== "unknown" ? `${d.facets.customer_segment.toUpperCase()} ` : "";
  return `Find documented decisions by ${stage}${seg}companies or teams about ${label(d.category).toLowerCase()}${
    opts.length ? `, choosing between ${opts.join(", ")}` : ""
  }. For each, what did they decide, when, and what was observed afterwards?`;
}

export function ResearchPanel({
  decision,
  privateText,
  privacyMode,
  prominent,
}: {
  decision: StructuredDecision;
  privateText: string;
  privacyMode: PrivacyMode;
  prominent: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [query, setQuery] = useState("");
  const [removed, setRemoved] = useState<string[]>([]);
  const [genWhere, setGenWhere] = useState<Where | null>(null);
  const [genNote, setGenNote] = useState<string | null>(null);
  const [keepCopy, setKeepCopy] = useState(false);
  const [saveResults, setSaveResults] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; grounding: GroundingMetadata | null; where: Where; saved: boolean } | null>(null);

  const privateCorpus = `${privateText}\n${decision.context}\n${decision.title}\n${decision.objective}`;
  const leaks = useMemo(() => (query ? findLeaks(privateCorpus, query) : []), [privateCorpus, query]);
  const canResearch = privacyMode === "cloud_research";

  async function startGeneralize() {
    setError(null);
    setPhase("generalizing");
    try {
      const summary = `${decision.title}. ${decision.objective}. ${decision.context}. Options: ${decision.alternatives.map((a) => a.label).join("; ")}`;
      const r = await generalizeQuery(summary);
      setQuery(r.data.query);
      setRemoved(r.data.removed);
      setGenWhere(r.where);
      setGenNote(null);
    } catch {
      setQuery(templateQuery(decision));
      setRemoved(["all free text (only category and option types were used)"]);
      setGenWhere(null);
      setGenNote("Private AI isn't available here, so we drafted the query from your category and option types only. Edit it as you like.");
    }
    setPhase("review");
  }

  async function approve() {
    setError(null);
    setPhase("running");
    try {
      const { consentId } = await api<{ consentId: string }>("/api/consent", {
        method: "POST",
        body: { purpose: "Live historical research for a decision", payload_text: query, keep_copy: keepCopy, save_results: saveResults, model: RESEARCH_MODEL },
      });
      const r = await runResearch(query, privacyMode, consentId);
      const chunks = r.grounding?.groundingChunks ?? [];
      const sources: Source[] = chunks.map((c) => ({ uri: c.web?.uri ?? "", title: c.web?.title ?? null, domain: c.web?.domain ?? null })).filter((s) => s.uri);
      const findings: Finding[] = (r.grounding?.groundingSupports ?? [])
        .filter((g) => g.segment?.text)
        .map((g) => ({ text: g.segment!.text, chunk_indices: g.groundingChunkIndices ?? [] }));
      let saved = false;
      if (saveResults) {
        const s = await api<{ saved: boolean }>("/api/research", {
          method: "POST",
          body: {
            consent_id: consentId,
            payload_text: query,
            decision_id: null,
            result_text: r.text,
            web_search_queries: r.grounding?.webSearchQueries ?? [],
            search_entry_point_html: r.grounding?.searchEntryPoint?.renderedContent ?? null,
            sources,
            findings,
          },
        });
        saved = s.saved;
      }
      setResult({ ...r, saved });
      setPhase("done");
    } catch (e) {
      setError(e instanceof RoutingError ? e.message : `Research couldn't run. Nothing was saved and your decision is unaffected. (${e instanceof Error ? e.message : String(e)})`);
      setPhase("review");
    }
  }

  if (phase === "idle" || phase === "declined") {
    return (
      <Card className={prominent ? "border-sky-300" : undefined}>
        <CardTitle hint="optional · cloud · needs your consent">Research this decision using the web</CardTitle>
        {phase === "declined" && <Notice tone="info">Research declined. Nothing was sent. You can continue with the evidence you have.</Notice>}
        <p className="mb-3 text-sm text-slate-600">Private AI first rewrites your decision into a general query on your device. You&apos;ll see and edit exactly what would be sent before anything leaves your browser.</p>
        <Button onClick={() => void startGeneralize()}>Prepare a research query</Button>
      </Card>
    );
  }

  if (phase === "generalizing") {
    return (
      <Card>
        <Spinner /> <span className="ml-2 text-sm">Generalizing your query on-device…</span>
      </Card>
    );
  }

  const chunks = result?.grounding?.groundingChunks ?? [];
  const supports = result?.grounding?.groundingSupports ?? [];

  return (
    <Card className="space-y-4 border-sky-300">
      <CardTitle hint="nothing is sent until you approve">Research preview &amp; consent</CardTitle>
      {genNote && <Notice tone="warn">{genNote}</Notice>}

      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Will be sent <InferenceBadge where={genWhere} />
        </div>
        <Textarea value={query} onChange={(e) => setQuery(e.target.value)} disabled={phase !== "review"} className="font-mono text-xs" />
        {leaks.length > 0 && (
          <Notice tone="warn">
            Possible private details still in the query: {leaks.map((l) => `“${l.text}” (${label(l.kind)})`).join(", ")}. Edit them out before approving.
          </Notice>
        )}
      </div>

      <div className="grid gap-3 text-sm md:grid-cols-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Will NOT be sent</div>
          <ul className="list-inside list-disc text-slate-700">
            <li>Your original description and context</li>
            <li>Your assumptions, reasons and notes</li>
            <li>Your personal decision history</li>
            {removed.map((r) => (
              <li key={r}>Removed on-device: {r}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Processed by</div>
          <p className="text-slate-700">Google Gemini ({RESEARCH_MODEL}) in the cloud via Firebase AI Logic, with Grounding with Google Search.</p>
            <label className="flex items-center gap-2">
            <input type="checkbox" checked={saveResults} onChange={(e) => setSaveResults(e.target.checked)} disabled={phase !== "review"} />
            Save findings and source links to my private research history
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={keepCopy} onChange={(e) => setKeepCopy(e.target.checked)} disabled={phase !== "review"} />
            Keep a copy of the sent query in my consent log
          </label>
        </div>
      </div>

      {!canResearch && (
        <Notice tone="info">
          You&apos;re in a mode that doesn&apos;t allow cloud research. <Link className="underline" href="/settings">Switch to Cloud Research mode</Link> to continue, or decline.
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      {phase !== "done" && (
        <div className="flex gap-2">
          <Button onClick={() => void approve()} disabled={!canResearch || phase === "running" || query.trim().length < 10}>
            {phase === "running" ? <Spinner /> : null} I authorize this one cloud request. Research
          </Button>
          <Button variant="secondary" onClick={() => setPhase("declined")} disabled={phase === "running"}>
            Decline
          </Button>
        </div>
      )}

      {result && (
        <div className="space-y-4 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <InferenceBadge where={result.where} />
            <Badge className="border-amber-300 bg-amber-50 text-amber-800">Research candidates · not verified by DecisionTrail</Badge>
            {result.saved && <Badge className="border-slate-300 text-slate-600">Saved to research history</Badge>}
          </div>

          {!result.grounding || chunks.length === 0 ? (
            <Notice tone="warn">
              The model didn&apos;t ground this answer in search results, so it isn&apos;t shown as research. No sufficiently comparable historical case was established.
              You can broaden the question and try again, or continue recording your decision.
            </Notice>
          ) : (
            <>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Source-backed statements</h3>
                <ul className="space-y-2">
                  {supports.filter((g) => g.segment?.text).map((g, i) => (
                    <li key={i} className="text-sm">
                      <span>{g.segment!.text}</span>{" "}
                      {(g.groundingChunkIndices ?? []).map((ci) => (
                        <a key={ci} href={chunks[ci]?.web?.uri} target="_blank" rel="noreferrer noopener" className="ml-1 rounded bg-slate-100 px-1.5 text-xs text-slate-700 hover:underline">
                          📄 {chunks[ci]?.web?.domain || chunks[ci]?.web?.title || `source ${ci + 1}`}
                        </a>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
              <details>
                <summary className="cursor-pointer text-sm text-slate-600">Full AI answer (includes interpretation, not all of it source-backed)</summary>
                <p className="ai-text mt-2 whitespace-pre-wrap text-sm">{result.text}</p>
              </details>
              <div>
                <h3 className="mb-1 text-sm font-semibold">Sources examined</h3>
                <ol className="list-inside list-decimal text-sm">
                  {chunks.map((c, i) => (
                    <li key={i}>
                      <a className="hover:underline" href={c.web?.uri} target="_blank" rel="noreferrer noopener">
                        {c.web?.title || c.web?.domain || c.web?.uri}
                      </a>
                    </li>
                  ))}
                </ol>
                {result.grounding.webSearchQueries?.length ? (
                  <p className="mt-1 text-xs text-slate-500">Searches run: {result.grounding.webSearchQueries.join(" · ")}</p>
                ) : null}
              </div>
            </>
          )}
          <SearchSuggestions html={result.grounding?.searchEntryPoint?.renderedContent} />
          <p className="text-xs text-slate-500">
            No outcome documented is not the same as a negative outcome. Check sources before relying on any finding.
          </p>
        </div>
      )}
    </Card>
  );
}
