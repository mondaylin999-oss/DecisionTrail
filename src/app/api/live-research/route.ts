import { withUser } from "@/lib/http";
import { LiveResearchZ } from "@/lib/validation";
import { closestFirst, countriesOf, listNames, nearbyCountries, placeOf, type Country } from "@/lib/web/countries";
import { NO_RESULT, parseCrossref, parseHackerNews, parseIntros, parseOpenAlex, parseStackExchange, relevant, safeCorrection, stackSites, withStackAnswers, type LiveResult, type StudyResult } from "@/lib/web/sources";
import { parseSearch } from "@/lib/web/wikipedia";

interface Payload {
  query: string;
  results: LiveResult[];
  unavailable: string[];
  /** Local scope: how many results mention a chosen country, and their names. */
  local?: { names: string; found: number; missing: string };
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

const statesResult = (r: LiveResult) => !r.snippet.startsWith(NO_RESULT);
/** Studies that state a result come first. */
const resultsFirst = <T extends LiveResult>(rows: T[]): T[] => [...rows.filter(statesResult), ...rows.filter((r) => !statesResult(r))];

// After a refusal (daily limit), don't ask OpenAlex again for a while.
let openAlexBlockedUntil = 0;

async function openAlex(search: string, extra: string[] = []): Promise<StudyResult[]> {
  if (Date.now() < openAlexBlockedUntil) throw new Error("429");
  const p = new URLSearchParams({
    "per-page": "25",
    filter: ["has_abstract:true", "language:en", "type:article|review", `cited_by_count:>${extra.length ? 0 : 2}`, ...extra].join(","),
    select: "id,doi,display_name,publication_year,cited_by_count,abstract_inverted_index,authorships",
  });
  if (search) p.set("search", search);
  // Optional free key: gives this server its own daily limit.
  if (process.env.OPENALEX_API_KEY) p.set("api_key", process.env.OPENALEX_API_KEY);
  try {
    return parseOpenAlex(await getJson(`https://api.openalex.org/works?${p}`));
  } catch (e) {
    if (e instanceof Error && /^(403|409|429)$/.test(e.message)) openAlexBlockedUntil = Date.now() + 15 * 60 * 1000;
    throw e;
  }
}

const crossref = async (words: string): Promise<StudyResult[]> =>
  parseCrossref(
    await getJson(`https://api.crossref.org/works?${new URLSearchParams({ "query.bibliographic": words, rows: "40", filter: "has-abstract:true,type:journal-article", select: "DOI,title,abstract,is-referenced-by-count,issued" })}`),
  );

/** OpenAlex "any of these words" filter. Phrases are quoted; separators can't appear in our own list. */
const anyOf = (cs: Country[]) => cs.flatMap((c) => c.words).map((w) => (/[\s.'-]/.test(w) ? `"${w}"` : w)).join("|");

async function worldStudies(query: string, short: string): Promise<StudyResult[]> {
  const first = relevant(await openAlex(query), query, 12);
  return first.length >= 3 || short === query ? first : [...first, ...relevant(await openAlex(short), short, 12)];
}

/** The chosen countries first; authors there, nearby countries and the world only when there is too little. */
async function localStudies(query: string, short: string, chosen: Country[]): Promise<StudyResult[]> {
  const topic = `title_and_abstract.search:${short.replace(/[,|:!"]/g, " ")}`;
  const placed = (rows: StudyResult[]) => relevant(rows, query, 25, 1).map((r) => ({ ...r, place: placeOf(r, chosen) }));
  // One search per country, then one from each in turn, so a well-studied country can't crowd out another.
  const lists = await Promise.all(chosen.map(async (c) => resultsFirst(placed(await openAlex("", [topic, `title_and_abstract.search:${anyOf([c])}`])).filter((r) => placeOf(r, [c]).closeness === "country"))));
  const rows = Array.from({ length: 25 }, (_, i) => lists.flatMap((l) => l.slice(i, i + 1))).flat();
  if (rows.length < 3) rows.push(...resultsFirst(placed(await openAlex(short, [`authorships.countries:${chosen.map((c) => c.code).join("|")}`]))));
  const near = nearbyCountries(chosen).slice(0, 12);
  if (rows.length < 4 && near.length) rows.push(...resultsFirst(placed(await openAlex("", [topic, `title_and_abstract.search:${anyOf(near)}`])).filter((r) => r.place.closeness !== "world")));
  if (rows.length < 4) rows.push(...resultsFirst(await worldStudies(query, short)).map((r) => ({ ...r, place: placeOf(r, chosen) })));
  return rows;
}

async function crossrefStudies(query: string, short: string, chosen: Country[]): Promise<StudyResult[]> {
  const found = await Promise.all([crossref(query), ...chosen.map((c) => crossref(`${short} ${c.name}`))]);
  const rows = relevant(found.flat(), query, 40, chosen.length ? 1 : 2);
  return chosen.length ? rows.map((r) => ({ ...r, place: placeOf(r, chosen) })) : rows;
}

function publicStudy(r: StudyResult): LiveResult {
  const { text: _text, authorCountries: _countries, ...rest } = r;
  void _text;
  void _countries;
  return rest;
}

/** Question-and-answer discussions from one Stack Exchange site. */
async function discussions(site: string, q: string, keep: (rows: ReturnType<typeof parseStackExchange>) => ReturnType<typeof parseStackExchange>): Promise<LiveResult[]> {
  const found = parseStackExchange(await getJson(`https://api.stackexchange.com/2.3/search/advanced?${new URLSearchParams({ order: "desc", sort: "relevance", q, site, pagesize: "12", answers: "1", filter: "withbody" })}`), site);
  const rows = keep(found).slice(0, 8);
  if (!rows.length) return [];
  // Only discussions with an answer are shown: the answer is the evidence.
  const answers = await getJson(`https://api.stackexchange.com/2.3/questions/${rows.map((r) => r.questionId).join(";")}/answers?${new URLSearchParams({ order: "desc", sort: "votes", site, pagesize: "100", filter: "withbody" })}`);
  return withStackAnswers(rows, answers);
}

const stories = async (q: string) => parseHackerNews(await getJson(`https://hn.algolia.com/api/v1/search?${new URLSearchParams({ tags: "story", hitsPerPage: "12", query: q })}`));

async function encyclopedia(pages: ReturnType<typeof parseSearch>): Promise<LiveResult[]> {
  if (!pages.length) return [];
  const intros = await getJson(`https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: "query", prop: "extracts", exintro: "1", explaintext: "1", exlimit: "max", titles: pages.map((p) => p.title).join("|"), format: "json" })}`)
    .then(parseIntros)
    .catch(() => new Map<string, string>());
  return pages
    .filter((p) => !/\bmay (also )?refer to:?$/.test(intros.get(p.title) ?? ""))
    .map((r) => ({ ...r, snippet: intros.get(r.title) ?? (r.snippet && `${r.snippet}…`), question: `What does Wikipedia say about “${r.title}”?`, kind: "background" as const, detail: "Encyclopedia" }));
}

const wikiUrl = (q: string) =>
  `https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: "query", list: "search", srsearch: q, srlimit: "6", srprop: "snippet", srinfo: "suggestion|totalhits", format: "json" })}`;

/**
 * Searches live sources for topic words picked from the user's question. POST keeps
 * the words out of URLs and access logs. One failing source never hides the others.
 */
export async function POST(req: Request) {
  return withUser(req, async () => {
    const { q, category, countries } = LiveResearchZ.parse(await req.json());
    const chosen = countriesOf([...new Set(countries)]);
    const key = `${category}|${chosen.map((c) => c.code).sort().join(".")}|${q.toLowerCase()}`;
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
    const place = <T extends LiveResult>(r: T): T => (chosen.length ? { ...r, place: placeOf({ title: r.title, text: `${r.question} ${r.snippet}` }, chosen) } : r);
    const sites = stackSites(category);

    const [studies, hn, stack, background] = await Promise.all([
      attempt(
        "OpenAlex and Crossref",
        async () => {
          try {
            return chosen.length ? await localStudies(query, short, chosen) : resultsFirst(await worldStudies(query, short));
          } catch {
            return resultsFirst(await crossrefStudies(query, short, chosen));
          }
        },
        [] as StudyResult[],
      ),
      attempt(
        "Hacker News",
        async () => {
          const near = (await Promise.all(chosen.map((c) => stories(`${short} ${c.name}`)))).flat();
          return [...near.filter((r) => placeOf({ title: r.title, text: r.question }, chosen).closeness === "country" && relevant([r], query, 1, 1).length), ...relevant(await stories(short), query, 3)];
        },
        [],
      ),
      attempt(
        "Stack Exchange",
        async () => {
          const word = query.split(/\s+/)[0];
          const about = (
            await Promise.all(
              chosen.map((c) =>
                discussions(sites[0], `${word} ${c.name}`, (rows) => rows.filter((r) => placeOf({ title: r.title, text: r.question }, [c]).closeness === "country" && relevant([r], query, 1, 1).length)),
              ),
            )
          ).flat();
          if (about.length >= 4) return about;
          const world = (await Promise.all(sites.map((x) => discussions(x, short, (rows) => relevant(rows, query, 8))))).flat();
          return [...about, ...relevant(world, query, 4)];
        },
        [],
      ),
      attempt(
        "Wikipedia",
        async () => {
          const found = (await Promise.all(chosen.map(async (c) => relevant(parseSearch(await getJson(wikiUrl(`${short} ${c.name}`))), query, 3, 1)))).flat();
          const near = (await encyclopedia([...new Map(found.map((p) => [p.url, p])).values()])).filter((r) => placeOf({ title: r.title, text: r.snippet }, chosen).closeness === "country");
          return [...near, ...(await encyclopedia(relevant(wiki, query, 3, 1)))];
        },
        [],
      ),
    ]);

    const seen = new Set<string>();
    const unique = <T extends LiveResult>(rows: T[]): T[] => rows.filter((r) => !seen.has(r.url) && seen.add(r.url));
    const pick = (rows: LiveResult[], enough: number, max: number) => (chosen.length ? closestFirst(rows, enough, max) : rows.slice(0, max));
    const results = [
      ...pick(unique(studies).map(publicStudy), 4, 5),
      ...pick(unique(stack).map(place), 3, 4),
      ...pick(unique(hn).map(place), 2, 3),
      ...pick(unique(background).map(place), 2, 3),
    ];
    const value: Payload = {
      query,
      results,
      unavailable: [...new Set(unavailable)],
      ...(chosen.length ? { local: { names: listNames(chosen), found: results.filter((r) => r.place?.closeness === "country").length, missing: listNames(chosen.filter((c) => !results.some((r) => r.place?.closeness === "country" && r.place.text.includes(c.name)))) } } : {}),
    };
    if (!value.unavailable.length) {
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(key, { at: Date.now(), value });
    }
    return Response.json(value);
  });
}
