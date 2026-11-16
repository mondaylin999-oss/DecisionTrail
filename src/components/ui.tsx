"use client";
/** Small shadcn-style primitives (no external UI dependency). */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useLanguage } from "@/lib/i18n";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-700 disabled:bg-slate-400",
  secondary: "bg-white text-slate-900 border border-slate-300 hover:bg-slate-100 disabled:text-slate-400",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "bg-red-600 text-white hover:bg-red-500",
};

export function Button({ variant = "primary", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const { t } = useLanguage();
  const content = typeof p.children === "string" ? t(p.children) : p.children;
  return (
    <button
      {...p}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
    >
      {content}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-lg border border-slate-200 bg-white p-5 shadow-sm", className)}>{children}</div>;
}

export function CardTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h2 className="text-base font-semibold text-slate-900">{typeof children === "string" ? t(children) : children}</h2>
      {hint && <span className="text-xs text-slate-500">{typeof hint === "string" ? t(hint) : hint}</span>}
    </div>
  );
}

export function Badge({ className, children, title }: { className?: string; children: ReactNode; title?: string }) {
  const { t } = useLanguage();
  return (
    <span title={title ? t(title) : undefined} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", className)}>
      {typeof children === "string" ? t(children) : children}
    </span>
  );
}

const field = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useLanguage();
  return <input {...p} placeholder={p.placeholder ? t(p.placeholder) : undefined} className={cn(field, p.className)} />;
}

export function Textarea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { t } = useLanguage();
  return <textarea {...p} placeholder={p.placeholder ? t(p.placeholder) : undefined} className={cn(field, "min-h-24", p.className)} />;
}

export function Select({
  options,
  labels,
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { options: readonly string[]; labels?: (v: string) => string }) {
  const { t } = useLanguage();
  return (
    <select {...rest} className={cn(field, className)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {t(labels ? labels(o) : o)}
        </option>
      ))}
    </select>
  );
}

export function Field({ label, children, aside }: { label: string; children: ReactNode; aside?: ReactNode }) {
  const { t } = useLanguage();
  return (
    <label className="block space-y-1">
      <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {t(label)} {aside}
      </span>
      {children}
    </label>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "ok"; children: ReactNode }) {
  const { t } = useLanguage();
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-900",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return <div role="status" className={cn("rounded-md border px-3 py-2 text-sm", tones[tone])}>{typeof children === "string" ? t(children) : children}</div>;
}

export function Spinner() {
  return <span aria-hidden className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}
