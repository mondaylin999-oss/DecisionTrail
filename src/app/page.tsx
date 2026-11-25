"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardTitle, Notice, SkeletonCard, SkeletonGroup, buttonClass } from "@/components/ui";
import { api } from "@/lib/api";
import { label } from "@/lib/vocab";

interface Stats {
  total: number;
  awaitingReview: number;
  researchSessions: number;
  byStatus: { status: string; n: number }[];
  outcomes: { status: string; n: number }[];
  byCategory: { category: string; n: number }[];
  upcoming: { id: string; title: string; reviewDueAt: string | null }[];
}

export default function Dashboard() {
  const { me } = useAuth();
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!me) return;
    api<Stats>("/api/stats").then(setS).catch((e) => setErr(String(e.message ?? e)));
  }, [me]);

  return (
    <>
      <PageTitle
        title="Dashboard"
        subtitle="Every number here is counted from your own records."
        actions={
          <Link href="/decisions/new" className={buttonClass()}>
            New decision
          </Link>
        }
      />
      {err && <Notice tone="error">{err}</Notice>}
      {s && s.awaitingReview > 0 && (
        <Notice tone="warn">
          <strong>Decisions ready for review: {s.awaitingReview}.</strong> Record what actually happened while you still remember.{" "}
          {s.upcoming[0] && (
            <Link href={`/decisions/${s.upcoming[0].id}`} className="font-semibold underline">
              {s.upcoming[0].title}
            </Link>
          )}
        </Notice>
      )}
      {!s && !err && (
        <SkeletonGroup className="space-y-4">
          <SkeletonCard lines={1} />
          <div className="grid gap-4 md:grid-cols-2">
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </div>
        </SkeletonGroup>
      )}
      {s && s.total === 0 && (
        <Card className="space-y-3">
          <CardTitle>Start your trail</CardTitle>
          <p className="text-sm text-muted">
            The most useful first step is logging a decision you&apos;ve already made and its outcome, so future decisions can learn from it.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/decisions/new?past=1" className={buttonClass("secondary")}>
            Log a past decision
          </Link>
            <Link href="/decisions/new" className={buttonClass()}>
            Start a new decision
          </Link>
          </div>
        </Card>
      )}
      {s && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-line py-4 md:grid-cols-4">
          <Stat n={s.total} label="Recorded decisions" />
          <Stat n={s.awaitingReview} label="Awaiting review" tone={s.awaitingReview > 0 ? "warn" : undefined} />
          <Stat n={s.outcomes.reduce((a, o) => a + Number(o.n), 0)} label="Completed reviews" />
          <Stat n={s.researchSessions} label="AI research sessions" />
        </dl>
      )}
      {s && s.total > 0 && (
        <div className="grid items-start gap-4 md:grid-cols-2">
          <Card>
            <CardTitle hint="pending reviews first">Upcoming reviews</CardTitle>
            {s.upcoming.length === 0 ? (
              <p className="text-sm text-muted">No scheduled reviews.</p>
            ) : (
              <ul className="divide-y divide-line">
                {s.upcoming.map((u) => {
                  const due = u.reviewDueAt ? new Date(u.reviewDueAt) : null;
                  const overdue = due && due.getTime() <= now;
                  return (
                    <li key={u.id} className="flex items-center justify-between py-2 text-sm">
                      <Link href={`/decisions/${u.id}`} className="hover:underline">
                        {u.title}
                      </Link>
                      <span className={overdue ? "font-medium text-signal" : "text-muted"}>
                        {due ? (overdue ? "Review now" : due.toLocaleDateString("en-US")) : "No date"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card>
            <CardTitle>Outcome distribution</CardTitle>
            <Bars rows={s.outcomes.map((o) => ({ k: label(o.status), n: Number(o.n) }))} empty="No reviewed outcomes yet." />
            <div className="mt-4">
              <CardTitle>Categories</CardTitle>
              <Bars rows={s.byCategory.map((o) => ({ k: label(o.category), n: Number(o.n) }))} empty="—" />
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: "warn" }) {
  return (
    <div className="flex flex-col-reverse justify-end">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={tone === "warn" ? "text-2xl font-semibold text-signal" : "text-2xl font-semibold text-ink"}>{n}</dd>
    </div>
  );
}

function Bars({ rows, empty }: { rows: { k: string; n: number }[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.n), 1);
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.k} className="flex items-center gap-2 text-sm">
          <span className="w-28 shrink-0 sm:w-40 text-ink">{r.k}</span>
          <span className="h-2.5 bg-brand" style={{ width: `${(r.n / max) * 60}%` }} />
          <span className="text-muted">{r.n}</span>
        </li>
      ))}
    </ul>
  );
}
