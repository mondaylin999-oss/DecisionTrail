"use client";
import { useState } from "react";
import type { MatchResult } from "@/lib/types";
import { DemoBadge, MatchBadge, OutcomeChip } from "./marks";
import { Badge, Button, Card } from "./ui";

/** Deterministic "potential lessons", phrased as questions rather than advice. */
function lessonQuestions(m: MatchResult): string[] {
  const q: string[] = [];
  for (const a of m.summary.failedAssumptions ?? []) q.push(`Does your current plan rely on “${a}” again? It didn't hold last time.`);
  for (const d of m.explanation.differences.slice(0, 3)) q.push(`How does this difference change what you should expect: ${d.toLowerCase()}?`);
  if (m.explanation.unknowns.length) q.push("What would you need to know to fill the gaps marked unknown?");
  return q;
}

export function MatchCard({ m, current }: { m: MatchResult; current: { title: string; context: string } }) {
  const [open, setOpen] = useState(false);
  const personal = m.targetType === "personal_decision";
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <MatchBadge label={m.label} />
        <OutcomeChip value={personal ? m.outcomeStatus : m.outcomeCategory} />
        {m.isDemo && <DemoBadge />}
        {m.isDraft && <Badge className="border-signal bg-signal-soft text-signal">Unverified draft</Badge>}
      </div>
      <div>
        <h3 className="font-semibold">{m.title}</h3>
        {m.summary.actorName && <p className="text-xs text-muted">{m.summary.actorName}</p>}
      </div>
      {!personal && m.explanation.similarities.length > 0 && (
        <p className="text-sm">
          <span className="font-medium">How it relates to your decision:</span> {m.explanation.similarities.slice(0, 3).join("; ")}
        </p>
      )}
      <p className="text-sm text-muted">
        <span className="font-medium">Why this label:</span> {m.reasons.join("; ")}
      </p>

      {personal && (m.summary.expectedOutcome || m.summary.observedOutcome) && (
        <div className="grid gap-2 rounded-2xl bg-subtle p-3 text-sm md:grid-cols-2">
          <div>
            <div className="text-sm font-semibold text-ink">You expected</div>
            <p>{m.summary.expectedOutcome || "—"}</p>
          </div>
          <div>
            <div className="text-sm font-semibold text-ink">What happened (your review)</div>
            <p>{m.summary.observedOutcome || "Not reviewed yet"}</p>
          </div>
          {m.summary.failedAssumptions?.length ? (
            <p className="md:col-span-2 text-signal">Assumptions that failed: {m.summary.failedAssumptions.join("; ")}</p>
          ) : null}
          {m.summary.heldAssumptions?.length ? (
            <p className="md:col-span-2 text-accent">Assumptions that held: {m.summary.heldAssumptions.join("; ")}</p>
          ) : null}
        </div>
      )}

      <Button variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? "Hide comparison" : "Compare with my situation"}
      </Button>

      {open && (
        <div className="space-y-3 border-t border-line pt-3 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-sm font-semibold text-ink">Your situation</div>
              <p className="font-medium">{current.title}</p>
              <p className="text-muted">{current.context}</p>
            </div>
            <div>
              <div className="text-sm font-semibold text-ink">{personal ? "Your earlier situation" : "Historical situation"}</div>
              <p className="font-medium">{m.title}</p>
              {m.summary.decisionMade && <p className="text-muted">Decision: {m.summary.decisionMade}</p>}
            </div>
          </div>
          <List title="Similarities" items={m.explanation.similarities} />
          <List title="Differences" items={m.explanation.differences} />
          <List title="Unknowns" items={m.explanation.unknowns} />
          {!personal && (
            <div>
              <div className="text-sm font-semibold text-ink">Observed outcome</div>
              <p>{m.summary.observedOutcome}</p>
            </div>
          )}
          {(m.summary.lessons || personal) && (
            <div>
              <div className="text-sm font-semibold text-ink">{personal ? "Lesson you recorded" : "Documented lessons"}</div>
              <p>{m.summary.lessons || "—"}</p>
            </div>
          )}
          <List title="Questions worth asking yourself" items={lessonQuestions(m)} />
          <p className="text-xs text-muted">Historical similarity does not predict your outcome.</p>
        </div>
      )}
    </Card>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="text-sm font-semibold text-ink">{title}</div>
      <ul className="list-inside list-disc">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
