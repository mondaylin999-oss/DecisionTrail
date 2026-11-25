"use client";
/** Searches Wikipedia and lists the user's saved online sources. No AI. */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import type { WebResult } from "@/lib/web/wikipedia";
import { useAuth } from "./AuthProvider";
import { Badge, Button, Card, CardTitle, Input, Notice, SkeletonCard, SkeletonGroup, Spinner } from "./ui";

interface SavedRef {
  id: string;
  url: string;
  title: string;
  snippet: string;
  publisher: string;
  savedAt: string;
}

export function OnlineSearch() {
  const { me } = useAuth();
  const [q, setQ] = useState("");
  const [lastQ, setLastQ] = useState("");
  const [results, setResults] = useState<WebResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [saved, setSaved] = useState<SavedRef[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyUrl, setBusyUrl] = useState<string | null>(null);

  const loadSaved = useCallback(() => {
    api<{ references: SavedRef[] }>("/api/web-references")
      .then((r) => setSaved(r.references))
      .catch((e) => setErr(String(e.message ?? e)));
  }, []);
  useEffect(() => {
    if (me) loadSaved();
  }, [me, loadSaved]);

  async function search(e: FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query.length < 2) return;
    setSearching(true);
    setErr(null);
    try {
      const r = await api<{ results: WebResult[] }>(`/api/web-search?q=${encodeURIComponent(query)}`);
      setResults(r.results);
      setLastQ(query);
    } catch (ex) {
      setErr(String((ex as Error).message ?? ex));
    } finally {
      setSearching(false);
    }
  }

  async function save(r: WebResult) {
    setBusyUrl(r.url);
    setErr(null);
    try {
      await api("/api/web-references", { method: "POST", body: { url: r.url, title: r.title, snippet: r.snippet, publisher: r.publisher, query: lastQ } });
      loadSaved();
    } catch (ex) {
      setErr(String((ex as Error).message ?? ex));
    } finally {
      setBusyUrl(null);
    }
  }

  async function remove(id: string) {
    setBusyUrl(id);
    setErr(null);
    try {
      await api("/api/web-references/delete", { method: "POST", body: { id } });
      loadSaved();
    } catch (ex) {
      setErr(String((ex as Error).message ?? ex));
    } finally {
      setBusyUrl(null);
    }
  }

  const savedUrls = new Set((saved ?? []).map((s) => s.url));

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <CardTitle hint="live from Wikipedia">Search online</CardTitle>
        <form onSubmit={search} className="flex flex-wrap gap-2">
          <Input
            aria-label="Search online"
            placeholder="e.g. Netflix Qwikster, congestion pricing, four-day week"
            value={q}
            maxLength={120}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-60 flex-1"
          />
          <Button type="submit" disabled={searching || q.trim().length < 2}>
            {searching && <Spinner />} Search
          </Button>
        </form>
        <p className="text-xs text-muted">
          Only the words you type are sent, to Wikipedia. Results are real pages with links, not AI summaries, and are unverified until you check them.
        </p>
        {err && <Notice tone="error">{err}</Notice>}
        {searching && (
          <SkeletonGroup className="space-y-2">
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </SkeletonGroup>
        )}
        {!searching && results && results.length === 0 && <Notice tone="info">No pages found. Try different words.</Notice>}
        {!searching && results && results.length > 0 && (
          <ul className="space-y-2">
            {results.map((r) => (
              <li key={r.url} className="rounded-lg border border-line bg-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-accent bg-subtle text-accent">{r.publisher}</Badge>
                  <Badge className="border-signal bg-signal-soft text-signal">Unverified</Badge>
                </div>
                <a href={r.url} target="_blank" rel="noreferrer noopener" className="mt-1 block font-semibold hover:underline">
                  {r.title}
                </a>
                {r.snippet && <p className="text-sm text-muted">{r.snippet}…</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="secondary" disabled={busyUrl === r.url || savedUrls.has(r.url)} onClick={() => void save(r)}>
                    {savedUrls.has(r.url) ? "Saved" : "Save reference"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {results && results.length > 0 && (
          <p className="text-xs text-muted">Snippets are from Wikipedia and available under CC BY-SA 4.0.</p>
        )}
      </Card>

      {saved && saved.length > 0 && (
        <Card className="space-y-2">
          <CardTitle hint="private to you">Saved references</CardTitle>
          <ul className="divide-y divide-line">
            {saved.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <a href={s.url} target="_blank" rel="noreferrer noopener" className="font-medium hover:underline">
                  {s.title}
                </a>
                <span className="flex gap-1">
                  <Button variant="ghost" disabled={busyUrl === s.id} onClick={() => void remove(s.id)}>
                    Remove
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
