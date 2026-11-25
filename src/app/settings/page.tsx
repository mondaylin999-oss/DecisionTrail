"use client";
import { useEffect, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { PrivacyPill } from "@/components/marks";
import { SettingsSkeleton } from "@/components/skeletons";
import { Button, Card, CardTitle, Notice } from "@/components/ui";
import { STATUS_TEXT } from "@/lib/ai/availability";
import { prepareDeviceModel } from "@/lib/ai/tasks";
import { api } from "@/lib/api";
import type { PrivacyMode } from "@/lib/vocab";

const MODES: { mode: PrivacyMode; title: string; body: string[] }[] = [
  {
    mode: "private",
    title: "Private",
    body: ["AI runs only on this device (Gemini Nano in Chrome).", "No cloud AI calls are possible.", "For each new decision, a few topic words from your question are sent to public search sources. This uses no AI.", "If on-device AI is unavailable, you fill in forms yourself."],
  },
  {
    mode: "hybrid",
    title: "Hybrid",
    body: ["On-device first.", "If that isn't possible, decision text is sent to cloud Gemini for structuring and summaries.", "Every AI result shows where it ran."],
  },
  {
    mode: "cloud_research",
    title: "Cloud Research",
    body: ["Everything in Hybrid, plus live web research.", "Research queries are generalized on-device, and you approve each one before sending.", "Uses cloud Gemini with Grounding with Google Search."],
  },
];

interface Consent { id: string; scope: string; purpose: string; service: string; grantedAt: string; payloadText: string | null }

export default function SettingsPage() {
  const { me, error, setPrivacyMode, aiStatus, refreshAiStatus } = useAuth();
  const [pending, setPending] = useState<PrivacyMode | null>(null);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!me) return;
    api<{ consents: Consent[] }>("/api/consents").then((r) => setConsents(r.consents)).catch(() => {});
  }, [me]);

  if (!me) return error ? null : <SettingsSkeleton />;

  async function choose(m: PrivacyMode) {
    const order: PrivacyMode[] = ["private", "hybrid", "cloud_research"];
    // Moving to a less private mode needs explicit confirmation; moving down applies immediately.
    if (order.indexOf(m) > order.indexOf(me!.privacyMode) && pending !== m) {
      setPending(m);
      return;
    }
    await setPrivacyMode(m);
    setPending(null);
    setMsg(`${"Privacy mode set to"} ${(m === "cloud_research" ? "Cloud Research" : m[0].toUpperCase() + m.slice(1))}.`);
  }

  async function download() {
    setMsg(null);
    try {
      await prepareDeviceModel((p) => setProgress(p));
      await refreshAiStatus();
      setMsg("On-device model is ready.");
    } catch (e) {
      setMsg(`Couldn't prepare on-device AI: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProgress(null);
    }
  }

  return (
    <>
      <PageTitle title="Settings" subtitle="Control where AI runs and see what you have authorized." />
      {msg && <Notice tone="info">{msg}</Notice>}
      <Card className="space-y-4">
        <CardTitle hint={<PrivacyPill mode={me.privacyMode} />}>Privacy mode</CardTitle>
        <p className="text-sm text-muted">Privacy modes control where AI processing happens. Your saved decisions are stored in your DecisionTrail account so you can access them later.</p>
        <div className="divide-y divide-line border-y border-line">
          {MODES.map((m) => (
            <div key={m.mode} className="grid gap-2 py-4 md:grid-cols-[10rem_1fr_auto] md:gap-6">
              <div className="font-semibold">{m.title}</div>
              <ul className="list-outside list-disc space-y-1 pl-5 text-sm text-muted">
                {m.body.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              {me.privacyMode === m.mode ? (
                <p className="text-sm font-semibold text-accent">Current mode</p>
              ) : (
                <Button variant={pending === m.mode ? "danger" : "secondary"} className="md:self-start" onClick={() => void choose(m.mode)}>
                  {pending === m.mode ? "Confirm: allow cloud processing" : `Switch to ${m.title}`}
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <CardTitle>On-device AI</CardTitle>
        <p className="text-sm">{aiStatus ? STATUS_TEXT[aiStatus] : "Checking…"}</p>
        {(aiStatus === "downloadable" || aiStatus === "downloading") && (
          <Button onClick={() => void download()} disabled={progress !== null}>
            {progress !== null ? `${"Downloading…"} ${Math.round(progress * 100)}%` : "Download on-device model"}
          </Button>
        )}
        {(aiStatus === "unavailable" || aiStatus === "unsupported_browser") && (
            <p className="text-sm text-muted">
            Needs desktop Chrome (Windows 10/11, macOS 13+, Linux or Chromebook Plus), at least 22 GB free disk space, and a GPU with more than 4 GB VRAM or 16 GB RAM with 4+ CPU cores. Check{" "}
            <code>chrome://on-device-internals</code>.
          </p>
        )}
      </Card>

      <Card className="space-y-2">
        <CardTitle hint="what you authorized, and when">Consent history</CardTitle>
        {consents.length === 0 ? (
          <p className="text-sm text-muted">No cloud consents yet.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {consents.map((c) => (
              <li key={c.id} className="py-2">
                <div className="font-medium">{c.purpose}</div>
                <div className="text-xs text-muted">
                  {new Date(c.grantedAt).toLocaleString()} · {c.service}
                </div>
                {c.payloadText && <p className="mt-1 font-mono text-xs text-muted">{c.payloadText}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
