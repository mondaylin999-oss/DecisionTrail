"use client";
/** Small shadcn-style primitives (no external UI dependency). */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "border-brand bg-brand text-white enabled:hover:bg-brand-hover disabled:opacity-50",
  secondary: "border-line bg-surface text-ink enabled:hover:bg-subtle disabled:text-muted",
  ghost: "border-line bg-surface text-ink enabled:hover:bg-subtle disabled:text-muted",
  danger: "border-brand bg-brand text-white enabled:hover:bg-brand-hover disabled:opacity-50",
};

/** One button shape everywhere. Links that act as buttons use this too. */
export function buttonClass(variant: Variant = "primary", className?: string) {
  return cn(
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition duration-150 enabled:active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed",
    variants[variant],
    className,
  );
}

export function Button({ variant = "primary", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...p} className={buttonClass(variant, className)} />;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("enter rounded-3xl border border-line bg-surface p-4 sm:p-6", className)}>{children}</div>;
}

export function CardTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 className="text-lg font-semibold text-ink">{children}</h2>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

export function Badge({ className, children, title }: { className?: string; children: ReactNode; title?: string }) {
  return (
    <span title={title ? title : undefined} className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

const field =
  "w-full rounded-2xl border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 sm:text-sm";

export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} placeholder={p.placeholder ? p.placeholder : undefined} className={cn(field, p.className)} />;
}

export function Textarea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} placeholder={p.placeholder ? p.placeholder : undefined} className={cn(field, "min-h-24", p.className)} />;
}

export function Select({
  options,
  labels,
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { options: readonly string[]; labels?: (v: string) => string }) {
  return (
    <select {...rest} className={cn(field, className)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {labels ? labels(o) : o}
        </option>
      ))}
    </select>
  );
}

export function Field({ label, children, aside }: { label: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center gap-2 text-sm font-semibold text-ink">
        {label} {aside}
      </span>
      {children}
    </label>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "ok"; children: ReactNode }) {
  const tones = {
    info: "border-accent bg-subtle text-ink",
    warn: "border-signal bg-signal-soft text-signal",
    error: "border-2 border-signal bg-signal-soft font-medium text-signal",
    ok: "border-accent bg-subtle text-accent",
  };
  return <div role="status" className={cn("rounded-2xl border px-4 py-2.5 text-sm", tones[tone])}>{children}</div>;
}

/** Placeholder block shown while data loads. Decorative: wrap groups in <SkeletonGroup>. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-2xl", className)} />;
}

/** Announces "Loading" once to screen readers while its skeleton children render. */
export function SkeletonGroup({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

/** A card-shaped placeholder with a title line and `lines` text lines. */
export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <Card className={cn("space-y-3", className)}>
      <Skeleton className="h-5 w-2/5" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-3/5" : "w-full")} />
      ))}
    </Card>
  );
}

export function Spinner() {
  return <span aria-hidden className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}
