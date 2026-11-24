"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, CardTitle, Notice, Skeleton, SkeletonCard, SkeletonGroup, cn } from "@/components/ui";
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
          <Link href="/decisions/new">
            <Button>New decision</Button>
          </Link>
        }
      />
      {err && <Notice tone="error">{err}</Notice>}
      {s && s.awaitingReview > 0 && (
        <Notice tone="warn">
          <strong>⏰ Decisions ready for review: {s.awaitingReview}.</strong> Record what actually happened while you still remember.{" "}
          {s.upcoming[0] && (
            <Link href={`/decisions/${s.upcoming[0].id}`} className="font-semibold underline">
              {s.upcoming[0].title} →
            </Link>
          )}
        </Notice>
      )}
      {!s && !err && (
        <SkeletonGroup className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="space-y-3">
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-3.5 w-3/4" />
              </Card>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </div>
        </SkeletonGroup>
      )}
      {s && s.total === 0 && (
        <Card className="space-y-3">
          <CardTitle>Start your trail</CardTitle>
          <p className="text-sm text-slate-600">
            The most useful first step is logging a decision you&apos;ve already made and its outcome, so future decisions can learn from it.
          </p>
          <div className="flex gap-2">
            <Link href="/decisions/new?past=1">
              <Button variant="secondary">Log a past decision</Button>
            </Link>
            <Link href="/decisions/new">
              <Button>Start a new decision</Button>
            </Link>
          </div>
        </Card>
      )}
      {s && (
        <div className="grid gap-4 md:grid-cols-4">
          <Stat n={s.total} label="Recorded decisions" />
          <Stat n={s.awaitingReview} label="Awaiting review" tone={s.awaitingReview > 0 ? "warn" : undefined} />
          <Stat n={s.outcomes.reduce((a, o) => a + Number(o.n), 0)} label="Completed reviews" />
          <Stat n={s.researchSessions} label="Research sessions" />
        </div>
      )}
      {s && s.total > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardTitle hint="pending reviews first">Upcoming reviews</CardTitle>
            {s.upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">No scheduled reviews.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {s.upcoming.map((u) => {
                  const due = u.reviewDueAt ? new Date(u.reviewDueAt) : null;
                  const overdue = due && due.getTime() <= now;
                  return (
                    <li key={u.id} className="flex items-center justify-between py-2 text-sm">
                      <Link href={`/decisions/${u.id}`} className="hover:underline">
                        {u.title}
                      </Link>
                      <span className={overdue ? "font-medium text-amber-700" : "text-slate-500"}>
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
    <Card className={cn("pop relative overflow-hidden", tone === "warn" && "border-amber-300")}>
      <span aria-hidden className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-violet-400/40 to-fuchsia-400/40 blur-xl" />
      <div className="gradient-text relative text-4xl font-black">{n}</div>
      <div className="relative mt-1 text-sm font-medium text-slate-600">{label}</div>
    </Card>
  );
}

function Bars({ rows, empty }: { rows: { k: string; n: number }[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-slate-500">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.n), 1);
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.k} className="flex items-center gap-2 text-sm">
          <span className="w-40 shrink-0 text-slate-700">{r.k}</span>
          <span className="h-2.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${(r.n / max) * 60}%` }} />
          <span className="text-slate-500">{r.n}</span>
        </li>
      ))}
    </ul>
  );
}
