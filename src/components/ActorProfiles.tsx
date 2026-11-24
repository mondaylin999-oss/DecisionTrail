"use client";
/** Public Wikipedia profiles of the people or organisations behind a library case. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "./ui";

interface Profile {
  kind: string;
  name: string;
  description: string;
  summary: string;
  url: string;
  born?: number | null;
  died?: number | null;
  founded?: number | null;
  education?: string[];
  photo?: { src: string; author: string; license: string; licenseUrl: string | null; page: string };
}
interface Data {
  retrievedAt: string;
  profiles: Record<string, Profile>;
  cases: Record<string, { id: string; role: string }[]>;
  titles: Record<string, string>;
}

/** Loaded on demand so the data stays out of the main bundle. */
function useProfileData(): Data | null {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    let live = true;
    import("@/data/profiles.json").then((m) => live && setData(m.default as unknown as Data)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return data;
}

function Photo({ p, size }: { p: Profile; size: string }) {
  const [failed, setFailed] = useState(false);
  if (p.photo && !failed)
    return (
      // Served by Wikimedia with no referrer. next/image would copy it through our server.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={p.photo.src}
        alt={p.kind === "person" ? `Photo of ${p.name}` : `Photo related to ${p.name}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn(size, "shrink-0 rounded-2xl object-cover object-top")}
      />
    );
  return (
    <span aria-hidden className={cn(size, "flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xl font-bold text-white")}>
      {p.name.slice(0, 1)}
    </span>
  );
}

function Out({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="underline" href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
}

function Credit({ p }: { p: Profile }) {
  if (!p.photo) return null;
  return (
    <p className="text-[10px] leading-tight text-slate-500">
      Photo: <Out href={p.photo.page}>{p.photo.author}</Out>, {p.photo.licenseUrl ? <Out href={p.photo.licenseUrl}>{p.photo.license}</Out> : p.photo.license}
    </p>
  );
}

function facts(p: Profile): string[] {
  const out: string[] = [];
  const dated = /\d{4}/.test(p.description);
  if (!dated && p.born) out.push(p.died ? `${p.born}–${p.died}` : `Born ${p.born}`);
  if (!dated && p.founded) out.push(`Founded ${p.founded}`);
  if (p.education?.length) out.push(`Education: ${p.education.join(", ")}`);
  return out;
}

export function ActorProfiles({ slug, compact = false }: { slug: string | undefined; compact?: boolean }) {
  const data = useProfileData();
  const links = (slug && data?.cases[slug]) || [];
  if (!data || links.length === 0) return null;

  if (compact)
    return (
      <div className="flex flex-wrap gap-4">
        {links.map(({ id, role }) => {
          const p = data.profiles[id];
          return (
            <div key={id} className="flex items-center gap-3">
              <Photo p={p} size="h-14 w-14" />
              <div className="text-sm">
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-slate-500">{role}</div>
                <Credit p={p} />
              </div>
            </div>
          );
        })}
      </div>
    );

  return (
    <div className="space-y-3">
      {links.map(({ id, role }) => {
        const p = data.profiles[id];
        const related = Object.keys(data.cases).filter((s) => s !== slug && data.cases[s].some((l) => l.id === id));
        return (
          <section key={id} aria-label={p.name} className="flex flex-col gap-4 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm sm:flex-row">
            <div className="w-28 shrink-0 space-y-1">
              <Photo p={p} size="h-32 w-28" />
              <Credit p={p} />
            </div>
            <div className="min-w-0 space-y-2">
              <div>
                <h4 className="text-base font-bold">{p.name}</h4>
                <p className="text-xs text-slate-500">{p.description}</p>
              </div>
              <p>
                <span className="font-medium">In this case:</span> {role}
              </p>
              {facts(p).map((f) => (
                <p key={f} className="text-slate-600">
                  {f}
                </p>
              ))}
              {p.summary && <p className="text-slate-600">{p.summary}</p>}
              {related.length > 0 && (
                <div>
                  <div className="text-xs font-medium uppercase text-slate-500">Other cases with {p.name}</div>
                  <ul className="list-inside list-disc">
                    {related.slice(0, 5).map((s) => (
                      <li key={s}>
                        <Link className="underline" href={`/explorer?case=${s}`}>
                          {data.titles[s]}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-slate-500">
                Profile from <Out href={p.url}>Wikipedia</Out> (<Out href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</Out>), retrieved {data.retrievedAt}. May be out of date.
              </p>
            </div>
          </section>
        );
      })}
    </div>
  );
}
