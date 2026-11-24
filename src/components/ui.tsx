"use client";
/** Small shadcn-style primitives (no external UI dependency). */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-md shadow-violet-500/30 hover:shadow-lg hover:shadow-fuchsia-500/30 disabled:from-slate-400 disabled:to-slate-400 disabled:shadow-none",
  secondary: "bg-white text-slate-900 border border-violet-200 hover:bg-violet-50 disabled:text-slate-400",
  ghost: "text-slate-700 hover:bg-violet-100",
  danger: "bg-gradient-to-r from-rose-600 to-red-500 text-white shadow-md shadow-red-500/25",
};

export function Button({ variant = "primary", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const content = p.children;
  return (
    <button
      {...p}
      className={cn(
        "pop inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:hover:transform-none",
        variants[variant],
        className,
      )}
    >
      {content}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-3xl border border-violet-100 bg-white/90 p-5 shadow-lg shadow-violet-200/40", className)}>{children}</div>;
}

export function CardTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h2 className="text-base font-bold text-slate-900">{children}</h2>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </div>
  );
}

export function Badge({ className, children, title }: { className?: string; children: ReactNode; title?: string }) {
  return (
    <span title={title ? title : undefined} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

const field =
  "w-full rounded-2xl border border-violet-200 bg-white px-3.5 py-2.5 text-sm transition-shadow placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-200/70";

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
      <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label} {aside}
      </span>
      {children}
    </label>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "ok"; children: ReactNode }) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-900",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return <div role="status" className={cn("rounded-2xl border px-4 py-2.5 text-sm", tones[tone])}>{children}</div>;
}

/** Placeholder block shown while data loads. Decorative: wrap groups in <SkeletonGroup>. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-xl", className)} />;
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
