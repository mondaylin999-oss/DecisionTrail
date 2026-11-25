"use client";
/** AI explanation of the evidence on screen. Runs only when asked, and only where the privacy mode allows. */
import Link from "next/link";
import { useState } from "react";
import { type Brief, usableItems } from "@/lib/ai/brief";
import { explainEvidence, type Where } from "@/lib/ai/tasks";
import { countriesOf } from "@/lib/web/countries";
import type { LiveResult } from "@/lib/web/sources";
import { useAuth } from "./AuthProvider";
import { InferenceBadge } from "./marks";
import { Button, Notice, Spinner } from "./ui";

export function EvidenceBrief({ question, results }: { question: string; results: LiveResult[] }) {
  const { me, aiStatus } = useAuth();
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ brief: Brief; where: Where } | null>(null);
  const [err, setErr] = useState(false);
  const items = usableItems(
    results.filter((r) => r.kind !== "background").map((r) => ({
      title: r.title,
      answer: r.snippet,
      url: r.url,
      // Where the authors work says little about where the evidence is from.
      place: countriesOf(r.located?.basis === "authors" ? [] : (r.located?.codes ?? [])).map((c) => c.name).join(", "),
    })),
  );
  if (!me || items.length < 2) return null;
  const isPrivate = me.privacyMode === "private";

  if (isPrivate && aiStatus !== "available")
    return (
      <p className="text-sm text-muted">
        AI explanation: on-device AI isn&apos;t ready in this browser. <Link className="text-accent underline" href="/settings">Open Settings</Link> to set it up or choose Hybrid mode. The evidence below doesn&apos;t need AI.
      </p>
    );

  async function run() {
    setBusy(true);
    setErr(false);
    try {
      const r = await explainEvidence(question, items, me!.privacyMode);
      setOut({ brief: r.data, where: r.where });
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="AI explanation" className="space-y-3 rounded-2xl border border-line bg-subtle p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold text-ink">Explain this evidence</h3>
        {out && <InferenceBadge where={out.where} />}
      </div>
      {!out && (
        <>
          <p className="text-sm text-muted">
            {isPrivate
              ? "Gemini Nano explains these results on your device. Nothing is sent to a cloud AI."
              : "Gemini Nano explains these results on your device if it can. Otherwise your question and these results go to cloud Gemini."}
          </p>
          <Button disabled={busy} onClick={() => void run()}>
            {busy && <Spinner />} {busy ? "Explaining…" : "Explain with AI"}
          </Button>
        </>
      )}
      {err && <Notice tone="warn">The AI explanation didn&apos;t work this time. The evidence below is unaffected.</Notice>}
      {out && out.brief.points.length === 0 && <Notice tone="info">The AI&apos;s answer wasn&apos;t supported by these sources, so it isn&apos;t shown. Read the evidence below.</Notice>}
      {out && out.brief.points.length > 0 && (
        <>
          <ul className="space-y-2">
            {out.brief.points.map((p, i) => (
              <li key={i} style={{ animationDelay: `${i * 150}ms` }} className="enter ai-text text-sm text-ink">
                {p.text}{" "}
                {p.sources.map((n) => (
                  <a key={n} href={items[n - 1].url} target="_blank" rel="noreferrer noopener" title={items[n - 1].title} className="mr-1 not-italic text-accent underline">
                    Source {n}
                  </a>
                ))}
              </li>
            ))}
          </ul>
          {out.brief.limits && <p className="text-sm text-muted">Limits: {out.brief.limits}</p>}
          <p className="text-xs text-muted">Written by AI from the sources linked above. It can be wrong, so open the sources. It isn&apos;t advice and doesn&apos;t predict your outcome.</p>
        </>
      )}
    </section>
  );
}
