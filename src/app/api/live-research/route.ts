import { withUser } from "@/lib/http";
import { LiveResearchZ } from "@/lib/validation";
import { parseHackerNews, parseIntros, parseOpenAlex, parseStackExchange, relevant, safeCorrection, stackSites, withStackAnswers, type LiveResult } from "@/lib/web/sources";
import { parseSearch } from "@/lib/web/wikipedia";

interface Payload {
  query: string;
  results: LiveResult[];
  unavailable: string[];
}

// Public results only, keyed by topic words. Protects the free sources' rate limits.
const cache = new Map<string, { at: number; value: Payload }>();
const TTL_MS = 60 * 60 * 1000;

async function getJson(url: string): Promise<unknown> {
  try {
    return await fetchJson(url);
  } catch (e) {
    // One retry for dropped connections; a refusal (rate limit) is not retried.
    if (e instanceof Error && /^\d{3}$/.test(e.message)) throw e;
    return fetchJson(url);
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": "research-lookup/1.0", Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

const statesResult = (r: LiveResult) => r.snippet.startsWith("What they found");

const wikiUrl = (q: string) =>
  `https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: "query", list: "search", srsearch: q, srlimit: "6", srprop: "snippet", srinfo: "suggestion|totalhits", format: "json" })}`;

/**
 * Searches live sources for topic words picked from the user's question. POST keeps
 * the words out of URLs and access logs. One failing source never hides the others.
 */
export async function POST(req: Request) {
  return withUser(req, async () => {
    const { q, category } = LiveResearchZ.parse(await req.json());
    const key = `${category}|${q.toLowerCase()}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return Response.json(hit.value);

    const unavailable: string[] = [];
    const attempt = async <T,>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn();
      } catch {
        unavailable.push(name);
        return fallback;
      }
    };

    // Wikipedia first: it also corrects spelling for the other sources.
    let query = q;
    const wiki = await attempt(
      "Wikipedia",
      async () => {
        const first = await getJson(wikiUrl(q));
        const info = (first as { query?: { searchinfo?: { suggestion?: unknown; totalhits?: unknown } } }).query?.searchinfo;
        query = safeCorrection(q, info?.suggestion, typeof info?.totalhits === "number" ? info.totalhits : 0);
        // One stray word ("adsd") must not block a correction or drag the search off topic.
        const two = q.split(/\s+/).slice(0, 2).join(" ");
        if (query === q && two !== q && typeof info?.totalhits === "number" && info.totalhits <= 20) {
          const i2 = ((await getJson(wikiUrl(two))) as { query?: { searchinfo?: { suggestion?: unknown; totalhits?: unknown } } }).query?.searchinfo;
          query = safeCorrection(two, i2?.suggestion, typeof i2?.totalhits === "number" ? i2.totalhits : 0);
        }
        const rows = query === q ? parseSearch(first) : parseSearch(await getJson(wikiUrl(query)));
        if (relevant(rows, query, 1, 1).length) return rows;
        return parseSearch(await getJson(wikiUrl(query.split(/\s+/)[0])));
      },
      [],
    );

    const short = query.split(/\s+/).slice(0, 2).join(" ");
    const openAlex = (x: string) =>
      getJson(
        `https://api.openalex.org/works?${new URLSearchParams({ search: x, "per-page": "25", filter: "has_abstract:true,language:en,type:article|review,cited_by_count:>2", select: "id,doi,display_name,publication_year,cited_by_count,abstract_inverted_index" })}`,
      ).then(parseOpenAlex);

    const [studies, hn, ...stack] = await Promise.all([
      attempt(
        "OpenAlex",
        async () => {
          const first = relevant(await openAlex(query), query, 12);
          const rows = first.length >= 3 || short === query ? first : [...first, ...relevant(await openAlex(short), short, 12)];
          // Studies that state a result come first.
          return [...rows.filter(statesResult), ...rows.filter((r) => !statesResult(r))];
        },
        [],
      ),
      attempt("Hacker News", async () => parseHackerNews(await getJson(`https://hn.algolia.com/api/v1/search?${new URLSearchParams({ tags: "story", hitsPerPage: "12", query: short })}`)), []),
      ...stackSites(category).map((site) =>
        attempt(
          "Stack Exchange",
          async () => {
            const found = parseStackExchange(await getJson(`https://api.stackexchange.com/2.3/search/advanced?${new URLSearchParams({ order: "desc", sort: "relevance", q: short, site, pagesize: "12", answers: "1", filter: "withbody" })}`), site);
            const rows = relevant(found, query, 8);
            if (!rows.length) return [];
            // Only discussions with an answer are shown: the answer is the evidence.
            const answers = await getJson(`https://api.stackexchange.com/2.3/questions/${rows.map((r) => r.questionId).join(";")}/answers?${new URLSearchParams({ order: "desc", sort: "votes", site, pagesize: "100", filter: "withbody" })}`);
            return withStackAnswers(rows, answers);
          },
          [] as LiveResult[],
        ),
      ),
    ]);

    const pages = relevant(wiki, query, 3, 1);
    const intros = pages.length
      ? await getJson(`https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: "query", prop: "extracts", exintro: "1", explaintext: "1", exlimit: "max", titles: pages.map((p) => p.title).join("|"), format: "json" })}`)
          .then(parseIntros)
          .catch(() => new Map<string, string>())
      : new Map<string, string>();
    const background: LiveResult[] = pages.filter((p) => !/may (also )?refer to:?$/.test(intros.get(p.title) ?? "")).map((r) => ({ ...r, snippet: intros.get(r.title) ?? (r.snippet && `${r.snippet}…`), kind: "background", detail: "Encyclopedia" }));
    const all = [...studies.slice(0, 5), ...relevant(stack.flat(), query, 4), ...relevant(hn, query, 3), ...background];
    const seen = new Set<string>();
    const value: Payload = { query, results: all.filter((r) => !seen.has(r.url) && seen.add(r.url)), unavailable: [...new Set(unavailable)] };
    if (!value.unavailable.length) {
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(key, { at: Date.now(), value });
    }
    return Response.json(value);
  });
}
