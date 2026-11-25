"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { Landing } from "./Landing";
import { SettingsMenu } from "./SettingsMenu";
import { ShellSkeleton } from "./skeletons";
import { ThemeToggle } from "./ThemeToggle";
import { Card, Notice, cn } from "./ui";

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
  if (!ready) return <ShellSkeleton logo={<Logo />} />;
  if (!user) return <Landing logo={<Logo />} toggle={<ThemeToggle />} footer={<Footer wide />} onSignIn={() => void signIn()} />;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <Link href="/" aria-label="DecisionTrail dashboard">
              <Logo />
            </Link>
            <SettingsMenu name={user.displayName ?? user.email ?? "Your account"} mode={me?.privacyMode ?? null} onSignOut={() => void signOut()} />
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

function Footer({ wide = false }: { wide?: boolean }) {
  return (
    <footer className="border-t border-line">
      <div className={cn("mx-auto flex w-full flex-wrap justify-between gap-x-6 gap-y-1 px-4 py-4 text-sm text-muted sm:px-6", wide ? "max-w-6xl" : "max-w-5xl")}>
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
