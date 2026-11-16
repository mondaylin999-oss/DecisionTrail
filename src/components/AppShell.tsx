"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { STATUS_TEXT } from "@/lib/ai/availability";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "./AuthProvider";
import { LanguageToggle } from "./LanguageToggle";
import { PrivacyPill } from "./marks";
import { ThemeToggle } from "./ThemeToggle";
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
  const { t } = useLanguage();
  const path = usePathname();

  if (!configured) {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">{t("DecisionTrail isn't configured yet")}</h1>
        <p className="text-sm text-slate-600">
          {t("Copy")} <code>.env.example</code> {t("to")} <code>.env.local</code>, {t("fill in your Firebase and database settings, and restart")} <code>npm run dev</code>. {t("See the README.")}
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
      <Centered decorate>
        <h1 className="text-2xl font-semibold">DecisionTrail</h1>
        <p className="text-slate-600">{t("Learn From the Past. Decide With Confidence.")}</p>
        <p className="text-sm text-slate-500">
          {t("See what you and documented others did in similar situations, and what actually happened. Then close the loop on your own outcome.")}
        </p>
        <Button onClick={() => void signIn()}>{t("Sign in with Google")}</Button>
      </Centered>
    );
  }

  const aiTone = aiStatus === "available" ? "border-emerald-300 text-emerald-800" : aiStatus?.startsWith("download") ? "border-amber-300 text-amber-800" : "border-slate-300 text-slate-500";

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-4">
        <Link href="/" className="mb-6 block">
          <div className="text-lg font-semibold">DecisionTrail</div>
          <div className="text-xs text-slate-500">{t("Precedent, not prediction")}</div>
        </Link>
        <nav className="space-y-1">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path === n.href || (n.href !== "/decisions" && path.startsWith(n.href)) || (n.href === "/decisions" && path.startsWith("/decisions/") && !path.startsWith("/decisions/new"));
            return (
              <Link key={n.href} href={n.href} className={cn("block rounded-md px-3 py-2 text-sm", active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100")}>
                {t(n.label)}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-6 py-3">
          <LanguageToggle />
          <ThemeToggle />
          {me && (
            <Link href="/settings" aria-label={t("Privacy mode settings")}>
              <PrivacyPill mode={me.privacyMode} />
            </Link>
          )}
          {aiStatus && <Badge className={aiTone}>{t(STATUS_TEXT[aiStatus])}</Badge>}
          <span className="text-sm text-slate-600">{user.displayName ?? user.email}</span>
          <Button variant="ghost" onClick={() => void signOut()}>
            {t("Sign out")}
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
      {decorate && <div className="absolute right-6 top-6 z-20 flex gap-2"><LanguageToggle /><ThemeToggle /></div>}
      <Card className="relative z-10 w-full max-w-md space-y-4 text-center">{children}</Card>
    </div>
  );
}

function SignInArtwork() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden sm:block">
      <svg className="absolute -left-8 top-[9%] w-44 text-emerald-200/80" viewBox="0 0 176 224" fill="none">
        <path d="M31 4 53 31 85 11 78 47 117 45 91 69 119 92 82 95 91 132 61 110 43 143 40 106 4 116 23 84 0 62 35 60Z" fill="currentColor" />
        <circle cx="114" cy="156" r="5" fill="currentColor" />
        <circle cx="137" cy="176" r="3" fill="currentColor" />
      </svg>
      <svg className="absolute -right-12 bottom-[12%] w-44 text-violet-200/80" viewBox="0 0 176 176" fill="none">
        <path d="M89 10c12-10 31-6 37 9 17-2 29 13 24 28 15 9 16 29 3 41 8 16-1 34-18 37-5 17-23 24-38 14-14 11-33 5-38-11-18 0-29-16-22-32-13-12-10-32 6-41-5-18 8-33 26-32 3-7 8-11 20-13Z" fill="currentColor" />
        <circle cx="44" cy="151" r="4" fill="currentColor" />
        <circle cx="27" cy="132" r="2.5" fill="currentColor" />
      </svg>
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{t(title)}</h1>
        {subtitle && <p className="text-sm text-slate-600">{t(subtitle)}</p>}
      </div>
      {actions}
    </div>
  );
}
