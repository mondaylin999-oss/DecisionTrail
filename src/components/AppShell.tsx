"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { STATUS_TEXT } from "@/lib/ai/availability";
import { useAuth } from "./AuthProvider";
import { PrivacyPill } from "./marks";
import { Badge, Button, Card, Notice, Spinner, cn } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/decisions/new", label: "New Decision" },
  { href: "/decisions", label: "My Decisions" },
  { href: "/explorer", label: "Historical Explorer" },
  { href: "/research", label: "Research History" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { ready, configured, user, me, aiStatus, signIn, signOut, error } = useAuth();
  const path = usePathname();

  if (!configured) {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">DecisionTrail isn&apos;t configured yet</h1>
        <p className="text-sm text-slate-600">
          Copy <code>.env.example</code> to <code>.env.local</code>, fill in your Firebase and database settings, and restart <code>npm run dev</code>. See the README.
        </p>
      </Centered>
    );
  }
  if (!ready) {
    return (
      <Centered>
        <Spinner />
      </Centered>
    );
  }
  if (!user) {
    return (
      <Centered>
        <h1 className="text-2xl font-semibold">DecisionTrail</h1>
        <p className="text-slate-600">Learn From the Past. Decide With Confidence.</p>
        <p className="text-sm text-slate-500">
          See what you and documented others did in similar situations, and what actually happened. Then close the loop on your own outcome.
        </p>
        <Button onClick={() => void signIn()}>Sign in with Google</Button>
      </Centered>
    );
  }

  const aiTone = aiStatus === "available" ? "border-emerald-300 text-emerald-800" : aiStatus?.startsWith("download") ? "border-amber-300 text-amber-800" : "border-slate-300 text-slate-500";

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-4">
        <Link href="/" className="mb-6 block">
          <div className="text-lg font-semibold">DecisionTrail</div>
          <div className="text-xs text-slate-500">Precedent, not prediction</div>
        </Link>
        <nav className="space-y-1">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path === n.href || (n.href !== "/decisions" && path.startsWith(n.href)) || (n.href === "/decisions" && path.startsWith("/decisions/") && !path.startsWith("/decisions/new"));
            return (
              <Link key={n.href} href={n.href} className={cn("block rounded-md px-3 py-2 text-sm", active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100")}>
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-6 py-3">
          {me && (
            <Link href="/settings" aria-label="Privacy mode settings">
              <PrivacyPill mode={me.privacyMode} />
            </Link>
          )}
          {aiStatus && <Badge className={aiTone}>{STATUS_TEXT[aiStatus]}</Badge>}
          <span className="text-sm text-slate-600">{user.displayName ?? user.email}</span>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-6">
          {error && <Notice tone="error">Couldn&apos;t reach the DecisionTrail server: {error}</Notice>}
          {children}
        </main>
      </div>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md space-y-4 text-center">{children}</Card>
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
