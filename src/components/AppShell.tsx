"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { PrivacyPill } from "./marks";
import { ThemeToggle } from "./ThemeToggle";
import { Button, Card, Notice, Skeleton, SkeletonGroup, cn } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/decisions/new", label: "New decision" },
  { href: "/decisions", label: "My decisions" },
  { href: "/research", label: "Saved research" },
  { href: "/settings", label: "Settings" },
];

// Set NEXT_PUBLIC_CONTACT_EMAIL to show a contact address. Nothing is invented when it's missing.
const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

function isActive(path: string, href: string) {
  return href === "/"
    ? path === "/"
    : path === href || (href !== "/decisions" && path.startsWith(href)) || (href === "/decisions" && path.startsWith("/decisions/") && !path.startsWith("/decisions/new"));
}

export function AppShell({ children }: { children: ReactNode }) {
  const { ready, configured, user, me, signIn, signOut, error } = useAuth();
  const path = usePathname();

  if (!configured) {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">DecisionTrail isn&apos;t configured yet</h1>
        <p className="text-sm text-muted">
          Copy <code>.env.example</code> to <code>.env.local</code>, fill in your Firebase and database settings, and restart <code>npm run dev</code>. See the README.
        </p>
      </Centered>
    );
  }
  if (!ready) {
    return (
      <Centered>
        <SkeletonGroup className="space-y-3">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-10 w-full" />
        </SkeletonGroup>
      </Centered>
    );
  }
  if (!user) return <SignIn onSignIn={() => void signIn()} />;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <Link href="/" aria-label="DecisionTrail dashboard">
              <Logo />
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              {me && (
                <Link href="/settings" aria-label="Privacy mode settings">
                  <PrivacyPill mode={me.privacyMode} />
                </Link>
              )}
              <span className="hidden max-w-48 truncate text-sm text-muted md:inline">{user.displayName ?? user.email}</span>
              <ThemeToggle />
              <Button variant="secondary" onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          </div>
          <nav aria-label="Main" className="-mx-2 flex flex-wrap sm:-mx-3">
            {NAV.map((n) => {
              const active = isActive(path, n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("border-b-2 px-2 py-2.5 text-sm sm:px-3", active ? "border-brand font-semibold text-ink" : "border-transparent text-muted hover:text-ink")}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {error && <Notice tone="error">Couldn&apos;t reach the DecisionTrail server: {error}</Notice>}
        {children}
      </main>
      <Footer />
    </div>
  );
}

/** The wordmark is decorative: the mark's alt text names the product once. */
function Logo() {
  return (
    <span className="flex items-center gap-3">
      <Image src="/logo-mark.svg" alt="DecisionTrail" width={36} height={36} unoptimized priority className="logo-mark" />
      <Image src="/wordmark-light.png" alt="" width={150} height={20} unoptimized priority className="only-light" />
      <Image src="/wordmark-dark.png" alt="" width={150} height={20} unoptimized priority className="only-dark" />
    </span>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap justify-between gap-x-6 gap-y-1 px-4 py-4 text-sm text-muted sm:px-6">
        <p>DecisionTrail shows evidence. It never decides for you or predicts your outcome.</p>
        {CONTACT && (
          <p>
            Contact:{" "}
            <a className="text-accent underline" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
          </p>
        )}
      </div>
    </footer>
  );
}

const STEPS = [
  { title: "Ask", text: "Describe your decision in plain language." },
  { title: "See evidence", text: "Read studies and discussions from OpenAlex, Stack Exchange, Hacker News and Wikipedia, next to your own past decisions." },
  { title: "Decide", text: "Save your choice, your reasons and a review date." },
  { title: "Review", text: "Record what happened and what you would do differently." },
];

function SignIn({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="mx-auto grid w-full max-w-5xl flex-1 content-center gap-10 px-4 py-8 sm:px-6 md:grid-cols-2 md:gap-16">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold text-ink">Research a decision, save your reasons, then check how it turned out</h1>
          <p className="text-base text-muted">DecisionTrail finds published evidence for the choice you face and keeps a record you can learn from. It never decides for you.</p>
          <Button onClick={onSignIn}>Sign in with Google</Button>
        </div>
        <section aria-labelledby="how" className="space-y-4">
          <h2 id="how" className="text-lg font-semibold text-ink">How it works</h2>
          <ol className="space-y-4">
            {STEPS.map((x, i) => (
              <li key={x.title} className="flex gap-3">
                <span aria-hidden className="w-5 shrink-0 font-semibold text-accent">{i + 1}</span>
                <div>
                  <h3 className="font-semibold text-ink">{x.title}</h3>
                  <p className="text-sm text-muted">{x.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md space-y-4">{children}</Card>
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
