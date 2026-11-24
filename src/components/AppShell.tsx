"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { STATUS_TEXT } from "@/lib/ai/availability";
import { useAuth } from "./AuthProvider";
import { PrivacyPill } from "./marks";
import { ThemeToggle } from "./ThemeToggle";
import { Badge, Button, Card, Notice, Skeleton, SkeletonGroup, cn } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/decisions/new", label: "New Decision", icon: "✨" },
  { href: "/decisions", label: "My Decisions", icon: "🧭" },
  { href: "/explorer", label: "Historical Explorer", icon: "🔭" },
  { href: "/research", label: "Research History", icon: "🔎" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

function isActive(path: string, href: string) {
  return href === "/"
    ? path === "/"
    : path === href || (href !== "/decisions" && path.startsWith(href)) || (href === "/decisions" && path.startsWith("/decisions/") && !path.startsWith("/decisions/new"));
}

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
        <SkeletonGroup className="space-y-3">
          <Skeleton className="mx-auto h-14 w-14 rounded-2xl" />
          <Skeleton className="mx-auto h-8 w-2/3" />
          <Skeleton className="mx-auto h-4 w-5/6" />
          <Skeleton className="mx-auto h-11 w-full rounded-full" />
        </SkeletonGroup>
      </Centered>
    );
  }
  if (!user) {
    return (
      <Centered decorate>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-orange-400 text-2xl font-black text-white shadow-lg shadow-fuchsia-500/30">
          D
        </div>
        <h1 className="gradient-text text-4xl font-black tracking-tight">DecisionTrail</h1>
        <p className="text-lg font-semibold text-slate-900">Learn From the Past. Decide With Confidence.</p>
        <p className="text-sm text-slate-500">
          See what you and documented others did in similar situations, and what actually happened. Then close the loop on your own outcome.
        </p>
        <Button className="w-full py-3 text-base" onClick={() => void signIn()}>Sign in with Google</Button>
      </Centered>
    );
  }

  const aiTone = aiStatus === "available" ? "border-emerald-300 text-emerald-800" : aiStatus?.startsWith("download") ? "border-amber-300 text-amber-800" : "border-slate-300 text-slate-500";

  return (
    <div className="flex min-h-screen">
      <aside className="glass sticky top-3 m-3 mr-0 hidden h-[calc(100vh-1.5rem)] w-60 shrink-0 flex-col rounded-3xl border border-violet-100 p-4 shadow-xl shadow-violet-200/40 md:flex">
        <Link href="/" className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-orange-400 text-lg font-black text-white shadow-md shadow-fuchsia-500/30">D</span>
          <span>
            <span className="gradient-text block text-lg font-black leading-tight">DecisionTrail</span>
            <span className="block text-xs text-slate-500">Precedent, not prediction</span>
          </span>
        </Link>
        <nav className="space-y-1.5">
          {NAV.map((n) => {
            const active = isActive(path, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all",
                  active ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-md shadow-violet-500/30" : "text-slate-700 hover:translate-x-0.5 hover:bg-violet-100",
                )}
              >
                <span aria-hidden className="text-base">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <nav className="glass mx-3 mt-3 flex gap-2 overflow-x-auto rounded-2xl border border-violet-100 p-2 md:hidden" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold", isActive(path, n.href) ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white" : "text-slate-700 hover:bg-violet-100")}
            >
              <span aria-hidden>{n.icon}</span> {n.label}
            </Link>
          ))}
        </nav>
        <header className="glass sticky top-3 z-20 mx-3 mt-3 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-violet-100 px-5 py-2.5 shadow-lg shadow-violet-200/30">
          <ThemeToggle />
          {me && (
            <Link href="/settings" aria-label="Privacy mode settings">
              <PrivacyPill mode={me.privacyMode} />
            </Link>
          )}
          {aiStatus && <Badge className={aiTone}>{STATUS_TEXT[aiStatus]}</Badge>}
          <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 text-xs font-bold text-white">
              {(user.displayName ?? user.email ?? "?").slice(0, 1).toUpperCase()}
            </span>
            {user.displayName ?? user.email}
          </span>
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

function Centered({ children, decorate = false }: { children: ReactNode; decorate?: boolean }) {
  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden p-6">
      {decorate && <SignInArtwork />}
      {decorate && <div className="absolute right-6 top-6 z-20 flex gap-2"><ThemeToggle /></div>}
      <Card className="relative z-10 w-full max-w-md space-y-4 text-center">{children}</Card>
    </div>
  );
}

function SignInArtwork() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden sm:block">
      <svg className="absolute -left-8 top-[9%] w-44 text-cyan-300/60" viewBox="0 0 176 224" fill="none">
        <path d="M31 4 53 31 85 11 78 47 117 45 91 69 119 92 82 95 91 132 61 110 43 143 40 106 4 116 23 84 0 62 35 60Z" fill="currentColor" />
        <circle cx="114" cy="156" r="5" fill="currentColor" />
        <circle cx="137" cy="176" r="3" fill="currentColor" />
      </svg>
      <svg className="absolute -right-12 bottom-[12%] w-44 text-fuchsia-300/60" viewBox="0 0 176 176" fill="none">
        <path d="M89 10c12-10 31-6 37 9 17-2 29 13 24 28 15 9 16 29 3 41 8 16-1 34-18 37-5 17-23 24-38 14-14 11-33 5-38-11-18 0-29-16-22-32-13-12-10-32 6-41-5-18 8-33 26-32 3-7 8-11 20-13Z" fill="currentColor" />
        <circle cx="44" cy="151" r="4" fill="currentColor" />
        <circle cx="27" cy="132" r="2.5" fill="currentColor" />
      </svg>
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
