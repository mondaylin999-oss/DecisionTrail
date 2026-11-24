"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { DemoBadge, OutcomeChip } from "@/components/marks";
import { Button, Card, Input, Notice, Select, Skeleton } from "@/components/ui";
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
  const { me } = useAuth();
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
          <Link href="/decisions/new">
            <Button>New decision</Button>
          </Link>
        }
      />
      {err && <Notice tone="error">{err}</Notice>}
      <div className="flex gap-2">
        <Input placeholder="Search titles…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select options={["all", ...CATEGORIES]} labels={(v) => (v === "all" ? "All categories" : label(v))} value={cat} onChange={(e) => setCat(e.target.value)} className="max-w-xs" />
      </div>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Decision</th>
              <th className="p-3">Category</th>
              <th className="p-3">Status</th>
              <th className="p-3">Decision date</th>
              <th className="p-3">Review due</th>
              <th className="p-3">Outcome</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="p-3">
                  <Link href={`/decisions/${r.id}`} className="font-medium hover:underline">
                    {r.title}
                  </Link>{" "}
                  {r.isDemo && <DemoBadge />}
                </td>
                <td className="p-3">{label(r.category)}</td>
                <td className={r.status === "awaiting_review" ? "p-3 font-medium text-amber-700" : "p-3"}>{label(r.status)}</td>
                <td className="p-3">{r.decidedAt ? new Date(r.decidedAt).toLocaleDateString("en-US") : "—"}</td>
                <td className="p-3">{r.reviewDueAt ? new Date(r.reviewDueAt).toLocaleDateString("en-US") : "—"}</td>
                <td className="p-3">
                  <OutcomeChip value={r.outcomeStatus} />
                </td>
              </tr>
            ))}
            {!rows && !err &&
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={`sk-${i}`} aria-hidden>
                  <td className="p-3"><Skeleton className="h-4 w-48" /></td>
                  <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="p-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="p-3"><Skeleton className="h-5 w-28 rounded-full" /></td>
                </tr>
              ))}
            {rows && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">
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
