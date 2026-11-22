"use client";
import { useEffect, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Card, Notice, SkeletonCard, SkeletonGroup } from "@/components/ui";
import { api } from "@/lib/api";
import { label } from "@/lib/vocab";
import { useLanguage } from "@/lib/i18n";

interface Session { id: string; queryText: string; status: string; createdAt: string }

export default function ResearchHistoryPage() {
  const { me } = useAuth();
  const { language } = useLanguage();
  const [rows, setRows] = useState<Session[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!me) return;
    api<{ sessions: Session[] }>("/api/research").then((r) => setRows(r.sessions)).catch((e) => setErr(String(e.message ?? e)));
  }, [me]);

  return (
    <>
      <PageTitle title="Research history" subtitle="Saved live-research sessions. Findings are research candidates, not verified cases." />
      {err && <Notice tone="error">{err}</Notice>}
      {rows?.length === 0 && <Notice tone="info">No research yet. Start one from a decision&apos;s evidence step.</Notice>}
      {!rows && !err && (
        <SkeletonGroup className="space-y-2">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} lines={1} />
          ))}
        </SkeletonGroup>
      )}
      <div className="space-y-2">
        {rows?.map((r) => (
          <Card key={r.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className={r.status === "completed" ? "border-emerald-300 text-emerald-800" : "border-amber-300 text-amber-800"}>{label(r.status)}</Badge>
              <span className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleString(language === "my" ? "my-MM" : "en-US")}</span>
            </div>
            <p className="font-mono text-xs text-slate-700">{r.queryText}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
