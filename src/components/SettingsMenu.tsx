"use client";
/** The only control in the top-right corner: account, privacy mode, theme and sign out. */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PrivacyMode } from "@/lib/vocab";
import { PrivacyPill } from "./marks";
import { ThemeToggle } from "./ThemeToggle";
import { Button, buttonClass, cn } from "./ui";

export function SettingsMenu({ name, mode, onSignOut }: { name: string; mode: PrivacyMode | null; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div
      ref={box}
      className="relative"
      onBlur={(e) => {
        // Tabbing past the last item closes it. A click on plain text has no new focus target.
        if (e.relatedTarget && !box.current?.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        aria-label="Settings menu"
        title="Settings"
        aria-expanded={open}
        aria-controls="settings-menu"
        onClick={() => setOpen(!open)}
        className={buttonClass("secondary", "h-11 w-11 !p-0")}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden className={cn("transition-transform duration-300 motion-reduce:transition-none", open && "rotate-90")}>
          <path d="M10.2 3h3.6l.5 2.6 1.6.7 2.2-1.5 2.5 2.5-1.5 2.2.7 1.6 2.6.5v3.6l-2.6.5-.7 1.6 1.5 2.2-2.5 2.5-2.2-1.5-1.6.7-.5 2.6h-3.6l-.5-2.6-1.6-.7-2.2 1.5-2.5-2.5 1.5-2.2-.7-1.6L2.1 15v-3.6l2.6-.5.7-1.6-1.5-2.2 2.5-2.5 2.2 1.5 1.6-.7z" transform="translate(-.1 -1.1)" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
      </button>
      {open && (
        <div id="settings-menu" className="enter absolute right-0 z-40 mt-2 w-64 max-w-[calc(100vw-2rem)] space-y-4 rounded-3xl border border-line bg-surface p-4 text-sm">
          <div>
            <p className="text-muted">Signed in as</p>
            <p className="break-words font-semibold text-ink">{name}</p>
          </div>
          {mode && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted">Privacy mode</span>
              <Link href="/settings" onClick={() => setOpen(false)} aria-label="Change privacy mode">
                <PrivacyPill mode={mode} />
              </Link>
            </div>
          )}
          <div className="grid gap-2 border-t border-line pt-4">
            <Link href="/settings" onClick={() => setOpen(false)} className={buttonClass("secondary", "w-full")}>
              Privacy &amp; AI
            </Link>
            <ThemeToggle className="w-full" />
            <Button variant="secondary" className="w-full" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
