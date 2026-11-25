"use client";
import { useEffect, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { OnlineSearch } from "@/components/OnlineSearch";
import { RowsSkeleton } from "@/components/skeletons";
import { Badge, Card, Notice } from "@/components/ui";
import { api } from "@/lib/api";
import { label } from "@/lib/vocab";

interface Session { id: string; queryText: string; status: string; createdAt: string }

export default function ResearchHistoryPage() {
  const { me, error } = useAuth();
  const [rows, setRows] = useState<Session[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!me) return;
    api<{ sessions: Session[] }>("/api/research").then((r) => setRows(r.sessions)).catch((e) => setErr(String(e.message ?? e)));
  }, [me]);

  return (
    <>
      <PageTitle title="Saved research" subtitle="Your saved online sources and AI research sessions. All unverified." />
      {err && <Notice tone="error">{err}</Notice>}
      {rows?.length === 0 && <Notice tone="info">No AI research sessions yet.</Notice>}
      {!rows && !err && !error && <RowsSkeleton />}
      <div className="space-y-2">
        {rows?.map((r) => (
          <Card key={r.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className={r.status === "completed" ? "border-accent text-accent" : "border-signal text-signal"}>{label(r.status)}</Badge>
              <span className="text-xs text-muted">{new Date(r.createdAt).toLocaleString("en-US")}</span>
            </div>
            <p className="font-mono text-xs text-ink">{r.queryText}</p>
          </Card>
        ))}
      </div>
      <OnlineSearch />
    </>
  );
}
