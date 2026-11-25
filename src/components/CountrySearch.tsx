"use client";
/** Type-to-search country list with flags. Keyboard: arrows, Enter, Escape. */
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { searchCountries } from "@/lib/web/countries";
import { cn, Input } from "./ui";

/** Image files, because Windows doesn't draw flag emoji. Decorative: the name is always next to it. */
export function Flag({ code }: { code: string }) {
  return <Image src={`/flags/${code}.svg`} alt="" width={24} height={16} unoptimized loading="lazy" className="h-4 w-6 shrink-0 rounded-sm border border-line object-cover" />;
}

export function CountrySearch({ exclude, label, onPick }: { exclude: string[]; label: string; onPick: (code: string) => void }) {
  const id = useId();
  const list = useRef<HTMLUListElement>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const found = searchCountries(text).filter((c) => !exclude.includes(c.code));
  const current = found[Math.min(active, found.length - 1)];

  // The field sits low on the page, so bring the opened list into view.
  useEffect(() => {
    if (open) list.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  function pick(code: string) {
    setText("");
    setActive(0);
    setOpen(false);
    onPick(code);
  }

  function move(to: number) {
    setOpen(true);
    if (!found.length) return;
    const i = (to + found.length) % found.length;
    setActive(i);
    list.current?.children[i]?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div className="relative sm:max-w-sm">
      <Input
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && current ? `${id}-${current.code}` : undefined}
        autoComplete="off"
        placeholder={`${label} (type to search)`}
        value={text}
        maxLength={60}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
          list.current?.scrollTo(0, 0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            move(open ? active + 1 : 0);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            move(open ? active - 1 : found.length - 1);
          } else if (e.key === "Enter") {
            // Never submit the question from here.
            e.preventDefault();
            if (open && current) pick(current.code);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <ul ref={list} id={`${id}-list`} role="listbox" aria-label="Countries" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border border-line bg-surface py-1 text-sm">
          {found.map((c, i) => (
            <li
              key={c.code}
              id={`${id}-${c.code}`}
              role="option"
              aria-selected={c === current}
              // Keeps focus in the field, so the list doesn't close before the click.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(c.code)}
              className={cn("flex cursor-pointer items-center gap-3 px-3 py-2.5", c === current && "bg-subtle font-semibold")}
            >
              <Flag code={c.code} /> {c.name}
            </li>
          ))}
          {found.length === 0 && (
            <li role="option" aria-selected={false} aria-disabled className="px-3 py-2.5 text-muted">
              No country matches “{text}”.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
