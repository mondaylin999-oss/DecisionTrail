"use client";

import { useLanguage } from "@/lib/i18n";

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <label className="inline-flex items-center">
      <span className="sr-only">Choose language</span>
      <select
        aria-label={language === "my" ? "ဘာသာစကားရွေးချယ်ရန်" : "Choose language"}
        value={language}
        onChange={(event) => setLanguage(event.target.value as "en" | "my")}
        className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700"
      >
        <option value="en">English</option>
        <option value="my">မြန်မာ</option>
      </select>
    </label>
  );
}
