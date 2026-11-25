"use client";
/** World or Local: which countries the user wants evidence for. Location is never detected. */
import { COUNTRIES, COUNTRY_CODES, countriesOf, MAX_COUNTRIES } from "@/lib/web/countries";
import { Button, Select } from "./ui";

export interface Scope {
  local: boolean;
  countries: string[];
}

const KEY = "decisiontrail-scope";

/** The last choice, kept in this browser only. */
export function savedScope(): Scope {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Scope> | null;
    const countries = Array.isArray(v?.countries) ? v.countries.filter((c) => COUNTRY_CODES.includes(c)).slice(0, MAX_COUNTRIES) : [];
    return { local: v?.local === true, countries };
  } catch {
    return { local: false, countries: [] };
  }
}

export function ScopePicker({ value, onChange }: { value: Scope; onChange: (s: Scope) => void }) {
  function set(s: Scope) {
    onChange(s);
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
  }
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-ink">Where should the evidence come from?</legend>
      <label className="flex items-center gap-2 py-1 text-sm">
        <input type="radio" name="scope" checked={!value.local} onChange={() => set({ ...value, local: false })} /> World: evidence from anywhere
      </label>
      <label className="flex items-center gap-2 py-1 text-sm">
        <input type="radio" name="scope" checked={value.local} onChange={() => set({ ...value, local: true })} /> Local: countries I choose
      </label>
      {value.local && (
        <div className="space-y-2 pl-6">
          {value.countries.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {countriesOf(value.countries).map((c) => (
                <li key={c.code}>
                  <Button type="button" variant="secondary" aria-label={`Remove ${c.name}`} onClick={() => set({ ...value, countries: value.countries.filter((x) => x !== c.code) })}>
                    {c.name} <span aria-hidden>×</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {value.countries.length < MAX_COUNTRIES && (
            <Select
              aria-label="Add a country"
              className="sm:max-w-xs"
              options={["", ...COUNTRIES.filter((c) => !value.countries.includes(c.code)).map((c) => c.code)]}
              labels={(v) => (v ? countriesOf([v])[0].name : value.countries.length ? "Add another country" : "Choose a country")}
              value=""
              onChange={(e) => e.target.value && set({ ...value, countries: [...value.countries, e.target.value] })}
            />
          )}
          <p className="text-xs text-muted">Up to {MAX_COUNTRIES}, English sources only. If there is too little, other results from the same region or the world are added. It is not ensured that a result applies to your country.</p>
        </div>
      )}
    </fieldset>
  );
}
