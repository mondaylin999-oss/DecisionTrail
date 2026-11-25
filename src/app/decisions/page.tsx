"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { DemoBadge, OutcomeChip } from "@/components/marks";
import { Card, Input, Notice, Select, Skeleton, buttonClass } from "@/components/ui";
import { api } from "@/lib/api";
import { CATEGORIES, label, type OutcomeStatus } from "@/lib/vocab";

interface Row {
  id: string;
  title: string;
  category: string;
  status: string;
  decidedAt: string | null;
  reviewDueAt: string | null;
  isDemo: boolean;
  outcomeStatus: OutcomeStatus | null;
}

export default function DecisionsPage() {
  const { me, error } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  useEffect(() => {
    if (!me) return;
    api<{ decisions: Row[] }>("/api/decisions").then((r) => setRows(r.decisions)).catch((e) => setErr(String(e.message ?? e)));
  }, [me]);

  const filtered = useMemo(
    () => (rows ?? []).filter((r) => (cat === "all" || r.category === cat) && r.title.toLowerCase().includes(q.toLowerCase())),
    [rows, q, cat],
  );

  return (
    <>
      <PageTitle
        title="My decisions"
        subtitle="Private to you. Original reasoning is preserved; changes are versioned."
        actions={
          <Link href="/decisions/new" className={buttonClass()}>
            New decision
          </Link>
        }
      />
      {err && <Notice tone="error">{err}</Notice>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input aria-label="Search titles" placeholder="Search titles" value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-xs" />
        <Select options={["all", ...CATEGORIES]} aria-label="Category" labels={(v) => (v === "all" ? "All categories" : label(v))} value={cat} onChange={(e) => setCat(e.target.value)} className="sm:max-w-xs" />
      </div>
      <Card className="!p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-sm text-muted">
            <tr>
              <th className="p-3">Decision</th>
              <th className="hidden p-3 md:table-cell">Category</th>
              <th className="hidden p-3 sm:table-cell">Status</th>
              <th className="hidden p-3 md:table-cell">Decision date</th>
              <th className="hidden p-3 md:table-cell">Review due</th>
              <th className="p-3">Outcome</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-subtle">
                <td className="p-3">
                  <Link href={`/decisions/${r.id}`} className="font-medium hover:underline">
                    {r.title}
                  </Link>{" "}
                  {r.isDemo && <DemoBadge />}
                </td>
                <td className="hidden p-3 md:table-cell">{label(r.category)}</td>
                <td className={r.status === "awaiting_review" ? "hidden p-3 font-medium text-signal sm:table-cell" : "hidden p-3 sm:table-cell"}>{label(r.status)}</td>
                <td className="hidden p-3 md:table-cell">{r.decidedAt ? new Date(r.decidedAt).toLocaleDateString("en-US") : "—"}</td>
                <td className="hidden p-3 md:table-cell">{r.reviewDueAt ? new Date(r.reviewDueAt).toLocaleDateString("en-US") : "—"}</td>
                <td className="p-3">
                  <OutcomeChip value={r.outcomeStatus} />
                </td>
              </tr>
            ))}
            {!rows && !err && !error &&
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={`sk-${i}`} aria-hidden>
                  <td className="p-3"><Skeleton className="h-4 w-48" /></td>
                  <td className="hidden p-3 md:table-cell"><Skeleton className="h-4 w-20" /></td>
                  <td className="hidden p-3 sm:table-cell"><Skeleton className="h-4 w-24" /></td>
                  <td className="hidden p-3 md:table-cell"><Skeleton className="h-4 w-20" /></td>
                  <td className="hidden p-3 md:table-cell"><Skeleton className="h-4 w-20" /></td>
                  <td className="p-3"><Skeleton className="h-5 w-28 rounded" /></td>
                </tr>
              ))}
            {rows && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-muted">
                  No decisions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}
