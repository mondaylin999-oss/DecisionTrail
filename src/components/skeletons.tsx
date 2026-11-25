"use client";
/** Loading placeholders shaped like the pages they stand in for, so nothing jumps when data arrives. */
import { useEffect, useState, type ReactNode } from "react";
import { Card, cn, Skeleton, SkeletonCard, SkeletonGroup } from "./ui";

/** Real progress text. After a while it explains the usual cause: the free server sleeps when idle. */
function Status({ children }: { children: ReactNode }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, []);
  return (
    <p className="text-sm text-muted" aria-live="polite">
      {children} {slow && "Still working. The server may be waking up, which can take up to a minute."}
    </p>
  );
}

const Lines = ({ n, className }: { n: number; className?: string }) => (
  <div className={cn("space-y-2", className)}>
    {Array.from({ length: n }, (_, i) => (
      <Skeleton key={i} className={cn("h-3.5", i === n - 1 && n > 1 ? "w-3/5" : "w-full")} />
    ))}
  </div>
);

const TitleSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="h-8 w-56 max-w-full" />
    <Skeleton className="h-4 w-96 max-w-full" />
  </div>
);

/** One evidence card: title and Save, source, flag and country, question, answer. */
function EvidenceCardSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-10 w-16 shrink-0" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-4 w-6" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Lines n={2} />
      <Lines n={2} />
    </div>
  );
}

function LiveResearchCards({ local }: { local: boolean }) {
  return (
    <>
      {local && <Skeleton className="h-12 w-full" />}
      <div className="space-y-3 rounded-2xl border border-line p-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-36" />
      </div>
      {[2, 1].map((n, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-5 w-48" />
          {Array.from({ length: n }, (_, j) => (
            <EvidenceCardSkeleton key={j} />
          ))}
        </div>
      ))}
    </>
  );
}

export function LiveResearchSkeleton({ local }: { local: boolean }) {
  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold text-ink">Live research</h2>
      <SkeletonGroup className="space-y-5">
        <Status>{local ? "Searching studies, discussions and Wikipedia, your countries first." : "Searching studies, discussions and Wikipedia."}</Status>
        <LiveResearchCards local={local} />
      </SkeletonGroup>
    </Card>
  );
}

/** Step 2 while the decision is being prepared. `status` says what is really happening. */
export function EvidenceStepSkeleton({ status, local }: { status: string; local: boolean }) {
  return (
    <SkeletonGroup className="space-y-6">
      <Card className="space-y-3">
        <Status>{status}</Status>
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-3/5" />
          <Skeleton className="h-10 w-32 shrink-0" />
        </div>
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-4 w-36" />
      </Card>
      <Card className="space-y-5">
        <Skeleton className="h-6 w-36" />
        <LiveResearchCards local={local} />
      </Card>
    </SkeletonGroup>
  );
}

export function AskSkeleton() {
  return (
    <SkeletonGroup className="space-y-6">
      <TitleSkeleton />
      <Skeleton className="h-5 w-56" />
      <Card className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-64 max-w-full" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-10 w-32" />
        <Lines n={2} />
      </Card>
    </SkeletonGroup>
  );
}

export function DashboardSkeleton() {
  return (
    <SkeletonGroup className="space-y-6">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-line py-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-7 w-10" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
      <div className="grid items-start gap-4 md:grid-cols-2">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={4} />
      </div>
    </SkeletonGroup>
  );
}

export function DecisionSkeleton() {
  return (
    <SkeletonGroup className="space-y-6">
      <TitleSkeleton />
      <div className="grid items-start gap-4 md:grid-cols-3">
        <Card className="space-y-5 md:col-span-2">
          <Skeleton className="h-6 w-40" />
          <Lines n={2} />
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
        </Card>
        <Card className="space-y-3">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-44" />
        </Card>
      </div>
    </SkeletonGroup>
  );
}

export function SettingsSkeleton() {
  return (
    <SkeletonGroup className="space-y-6">
      <TitleSkeleton />
      <Card className="space-y-4">
        <Skeleton className="h-6 w-36" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-2 border-t border-line pt-4 md:grid-cols-[10rem_1fr_auto] md:gap-6">
            <Skeleton className="h-5 w-24" />
            <Lines n={3} />
            <Skeleton className="h-10 w-36" />
          </div>
        ))}
      </Card>
      <SkeletonCard lines={2} />
    </SkeletonGroup>
  );
}

/** Saved research: one row per saved item. */
export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <SkeletonGroup className="divide-y divide-line">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-3">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-10 w-20 shrink-0" />
          </div>
        ))}
      </SkeletonGroup>
    </Card>
  );
}

/** Before sign-in is known. Neutral on purpose: it may become the sign-in page or the app. */
export function ShellSkeleton({ logo }: { logo: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          {logo}
          <Skeleton className="h-10 w-24" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <SkeletonGroup className="space-y-6">
          <Status>Checking your sign-in.</Status>
          <TitleSkeleton />
          <SkeletonCard lines={4} />
        </SkeletonGroup>
      </main>
    </div>
  );
}
