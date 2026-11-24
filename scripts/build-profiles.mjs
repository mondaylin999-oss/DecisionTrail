/**
 * Builds src/data/profiles.json: public Wikipedia profiles for the people and
 * organisations in the case library.   node scripts/build-profiles.mjs
 *
 * - People are linked to a case by hand below, only where they took part in it.
 * - Photos must be freely licensed; the author and licence are stored and shown.
 * - Details are limited to public, professional facts (no family, address, health, etc.).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

/** slug -> [Wikipedia title, role in this case] */
const PEOPLE = {
  "37signals-cloud-exit-2023": [["David Heinemeier Hansson", "Co-owner who published the company's account"]],
  "airbnb-pandemic-layoffs-2020": [["Brian Chesky", "CEO who announced the cuts"]],
  "airbnb-professional-photography-2009": [["Joe Gebbia", "Co-founder who photographed listings"], ["Brian Chesky", "Co-founder who photographed listings"]],
  "amazon-five-day-office-mandate-2024": [["Andy Jassy", "CEO who announced the policy"]],
  "amazon-kindle-launch-2007": [["Jeff Bezos", "Presented the Kindle at launch"]],
  "apple-itunes-music-store-2003": [["Steve Jobs", "Apple's CEO at launch"]],
  "apple-maps-ios6-apology-2012": [["Tim Cook", "CEO who published the apology"]],
  "apple-product-line-simplification-1997": [["Steve Jobs", "Led the product cuts"]],
  "apple-removes-headphone-jack-2016": [["Phil Schiller", "Executive who presented the change"]],
  "apple-retail-stores-2001": [["Steve Jobs", "Presented the first store to the press"]],
  "basecamp-political-discussion-ban-2021": [["David Heinemeier Hansson", "Co-owner who announced the severance offer"]],
  "best-buy-ends-rowe-2013": [["Hubert Joly", "CEO when the programme ended"]],
  "bezos-regret-minimization-leaves-de-shaw-1994": [["Jeff Bezos", "Made this decision"]],
  "blockbuster-declines-netflix-2000": [["John Antioco", "Blockbuster's CEO"], ["Reed Hastings", "Netflix co-founder who made the offer"], ["Marc Randolph", "Netflix co-founder who made the offer"]],
  "coca-cola-new-coke-1985": [["Roberto Goizueta", "The company's chairman and CEO"]],
  "coinbase-apolitical-mission-2020": [["Brian Armstrong (businessman)", "CEO who announced the policy"]],
  "digg-v4-redesign-2010": [["Kevin Rose", "Co-founder and interim CEO at the time"]],
  "disney-acquires-pixar-2006": [["Bob Iger", "Disney's CEO"], ["Steve Jobs", "Became Disney's largest shareholder through the deal"]],
  "dropbox-referral-program-2008": [["Drew Houston", "Founder who presented the results"]],
  "duolingo-ai-first-memo-2025": [["Luis von Ahn", "CEO who wrote the memo"]],
  "facebook-acquires-instagram-2012": [["Mark Zuckerberg", "CEO who announced the deal"], ["Kevin Systrom", "Instagram co-founder"]],
  "facebook-news-feed-launch-2006": [["Mark Zuckerberg", "Founder who responded to users"]],
  "ford-mortgages-assets-2006": [["Alan Mulally", "Ford's CEO from 2006"]],
  "google-acquires-android-2005": [["Andy Rubin", "Android co-founder who joined Google"]],
  "google-project-oxygen-2008": [["Laszlo Bock", "Led people operations at Google"]],
  "google-stadia-shutdown-2022": [["Phil Harrison", "Stadia executive who announced the closure"]],
  "google-wave-discontinued-2010": [["Urs Hölzle", "Executive who announced the decision"]],
  "hotmail-email-signature-viral-loop-1996": [["Tim Draper", "Investor who pushed for the tagline"], ["Sabeer Bhatia", "Hotmail co-founder"]],
  "instagram-burbn-pivot-2010": [["Kevin Systrom", "Co-founder"], ["Mike Krieger", "Co-founder"]],
  "intel-exits-dram-business-1985": [["Andrew Grove", "Recommended leaving memory chips"], ["Gordon Moore", "Recommended leaving memory chips"]],
  "klarna-ai-customer-service-reversal-2025": [["Sebastian Siemiatkowski", "CEO who explained the change"]],
  "lego-turnaround-2004": [["Jørgen Vig Knudstorp", "CEO who led the turnaround"]],
  "marvel-self-financing-film-slate-2005": [["Isaac Perlmutter", "Approved the plan with the board"]],
  "meta-year-of-efficiency-2023": [["Mark Zuckerberg", "CEO who announced the plan"]],
  "microsoft-acquires-github-2018": [["Satya Nadella", "Microsoft's CEO"]],
  "microsoft-invests-in-apple-1997": [["Bill Gates", "Microsoft's CEO"], ["Steve Jobs", "Announced the deal"]],
  "mit-opencourseware-2001": [["Charles M. Vest", "MIT president who announced it"]],
  "netflix-house-of-cards-original-2011": [["Ted Sarandos", "Content executive who made the commitment"]],
  "netflix-qwikster-2011": [["Reed Hastings", "CEO who announced and reversed the plan"]],
  "nintendo-wii-casual-strategy-2006": [["Satoru Iwata", "Nintendo's president"]],
  "nokia-windows-phone-bet-2011": [["Stephen Elop", "CEO who chose Windows Phone"]],
  "patagonia-purpose-trust-ownership-2022": [["Yvon Chouinard", "Founder who transferred ownership"]],
  "quibi-launch-and-shutdown-2020": [["Jeffrey Katzenberg", "Founder"], ["Meg Whitman", "CEO"]],
  "reddit-api-pricing-2023": [["Steve Huffman", "CEO who kept the policy"]],
  "shopify-calendar-purge-2023": [["Tobias Lütke", "Shopify's CEO"]],
  "slack-pivot-from-glitch-2012": [["Stewart Butterfield", "Co-founder who wrote the memo"]],
  "square-free-card-reader-2010": [["Jack Dorsey", "Co-founder"], ["Jim McKelvey", "Co-founder"]],
  "stanford-free-online-ai-course-2011": [["Sebastian Thrun", "Taught the course"], ["Peter Norvig", "Taught the course"]],
  "starbucks-store-closure-retraining-2008": [["Howard Schultz", "CEO who ordered the training"]],
  "steve-jobs-drops-out-of-reed-1972": [["Steve Jobs", "Made this decision"]],
  "tesla-opens-patents-2014": [["Elon Musk", "CEO who announced the pledge"]],
  "twitter-mass-layoffs-2022": [["Elon Musk", "New owner when the layoffs were made"]],
  "unity-runtime-fee-2023-2024": [["John Riccitiello", "CEO when the fee was introduced"]],
  "wework-ipo-withdrawn-2019": [["Adam Neumann", "Co-founder who stepped down as CEO"]],
  "whatsapp-drops-annual-fee-2016": [["Jan Koum", "CEO who announced the change"]],
  "yahoo-ends-work-from-home-2013": [["Marissa Mayer", "Yahoo's CEO"]],
  "yahoo-rejects-microsoft-bid-2008": [["Jerry Yang", "Co-founder and CEO"], ["David Filo", "Co-founder"]],
  "zappos-holacracy-buyout-2015": [["Tony Hsieh", "CEO who wrote the memo"]],
  "zoom-90-day-feature-freeze-2020": [["Eric Yuan", "CEO who announced the freeze"]],
};

/** Organisation shown when a case has no linked person. actor_name -> Wikipedia title */
const ORGS = {
  "Adobe": "Adobe Inc.", "Amazon": "Amazon (company)", "Amazon Web Services": "Amazon Web Services", "Amazon Prime Video": "Amazon Prime Video", "AOL and Time Warner": "AOL Time Warner",
  "Atlassian": "Atlassian", "Blockbuster": "Blockbuster (retailer)", "Buffer": "Buffer (application)", "Costco (Price/Costco)": "Costco", "CrowdStrike": "CrowdStrike", "Discord": "Discord",
  "The Walt Disney Company": "The Walt Disney Company", "Docker": "Docker, Inc.", "Domino's Pizza": "Domino's", "Dropbox": "Dropbox", "Evernote": "Evernote", "Gap": "Gap Inc.",
  "Georgia Tech, Udacity and AT&T": "Georgia Tech", "GitHub": "GitHub", "GitLab": "GitLab", "Google": "Google", "HashiCorp": "HashiCorp", "Heroku (Salesforce)": "Heroku", "IBM": "IBM",
  "Intel": "Intel", "Johnson & Johnson": "Johnson & Johnson", "Juicero": "Juicero", "Knight Capital": "Knight Capital Group", "Mailchimp": "Mailchimp", "Microsoft": "Microsoft", "Microsoft Japan": "Microsoft",
  "Netflix": "Netflix, Inc.", "Patagonia": "Patagonia, Inc.", "Quaker Oats": "Quaker Oats Company", "Redis": "Redis", "Samsung": "Samsung Electronics", "Segment": "Twilio", "Shopify": "Shopify",
  "Spotify": "Spotify", "Stack Overflow": "Stack Overflow", "Transport for London": "Transport for London", "Tropicana (PepsiCo)": "Tropicana Brands Group", "Twitter": "Twitter", "Webvan": "Webvan",
  "City of Bogota": "Bogotá", "City of Oslo": "Oslo", "City of Seattle": "Seattle", "MTA and State of New York": "Metropolitan Transportation Authority",
};

const UA = { "User-Agent": "case-library-profile-builder/1.0 (generic research script)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(host, params) {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { headers: UA });
    if (r.ok) { await sleep(1500); return r.json(); }
    await sleep(15000 * (i + 1));
  }
  throw new Error("failed " + url);
}
const text = (h) => (h ?? "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
/** First sentence, without the birth-date/pronunciation parenthesis, so bios stay professional. */
function brief(s) {
  let t = s;
  for (let i = 0; i < 3; i++) t = t.replace(/\s*\([^()]*\)/g, "");
  const m = /^(.*?[a-z0-9)\]"]{2}\.)(?=\s+[A-Z]|$)/s.exec(t.replace(/\s+/g, " ").trim());
  return m ? m[1] : t.trim();
}
const adultEducation = (a) => a.filter((n) => !/elementary|middle school|high school|secondary|preparatory|gymnasium/i.test(n));
const FREE = /^(cc0|cc[ -]by(-sa)?[ -]\d|public domain|pd\b|attribution|gfdl)/i;

const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
async function entities(ids, props) {
  const out = {};
  for (const c of chunks([...new Set(ids)], 50)) Object.assign(out, (await get("www.wikidata.org", { action: "wbgetentities", ids: c.join("|"), props, languages: "en" })).entities);
  return out;
}
async function pages(titles, n, params) {
  const out = {};
  for (const c of chunks(titles, n)) {
    const q = (await get("en.wikipedia.org", { action: "query", titles: c.join("|"), redirects: "1", ...params })).query;
    const to = Object.fromEntries([...(q.normalized ?? []), ...(q.redirects ?? [])].map((r) => [r.from, r.to]));
    for (const t of c) { let k = t; for (let i = 0; i < 3 && to[k]; i++) k = to[k]; out[t] = q.pages.find((p) => p.title === k); }
  }
  return out;
}

/** kinds: { title: "person" | "organisation" } */
async function buildProfiles(kinds) {
  const titles = Object.keys(kinds);
  const pg = await pages(titles, 20, { prop: "extracts|pageimages|pageprops|description|info", inprop: "url", exintro: "1", explaintext: "1", exsentences: "3", exlimit: "20", piprop: "thumbnail|name", pithumbsize: "320", pilimit: "50", pilicense: "free" });
  const ent = await entities(titles.map((t) => pg[t]?.pageprops?.wikibase_item).filter(Boolean), "claims");
  const ids = (e, pid) => (e?.claims[pid] ?? []).filter((c) => c.rank !== "deprecated").map((c) => c.mainsnak.datavalue?.value?.id).filter(Boolean);
  const year = (e, pid) => { const v = e?.claims[pid]?.[0]?.mainsnak.datavalue?.value; return v && v.precision >= 9 ? Number(v.time.slice(1, 5)) : null; };
  const E = (t) => ent[pg[t]?.pageprops?.wikibase_item];
  const people = titles.filter((t) => kinds[t] === "person");
  const labels = await entities(people.flatMap((t) => ids(E(t), "P69")), "labels");
  const names = (a) => [...new Set(a.map((i) => labels[i]?.labels?.en?.value).filter(Boolean))];
  const imgs = titles.map((t) => pg[t]).filter((p) => p?.thumbnail && p.pageimage && !/\.svg$/i.test(p.pageimage)).map((p) => "File:" + p.pageimage.replace(/_/g, " "));
  const im = await pages([...new Set(imgs)], 40, { prop: "imageinfo", iiprop: "extmetadata|url" });
  const out = {};
  for (const t of titles) {
    const p = pg[t], e = E(t);
    if (!p || p.missing || !e || "disambiguation" in (p.pageprops ?? {})) { out[t] = { error: "missing or ambiguous" }; continue; }
    if (kinds[t] === "person" && !ids(e, "P31").includes("Q5")) { out[t] = { error: "not a person: " + p.title }; continue; }
    const r = (out[t] = { kind: kinds[t], name: p.title.replace(/ \([^)]*\)$/, ""), description: p.description ?? "", summary: brief(p.extract ?? ""), url: p.canonicalurl });
    if (kinds[t] === "person") Object.assign(r, { born: year(e, "P569"), died: year(e, "P570"), education: adultEducation(names(ids(e, "P69"))) });
    else r.founded = year(e, "P571");
    const info = p.pageimage && im["File:" + p.pageimage.replace(/_/g, " ")]?.imageinfo?.[0];
    const m = info?.extmetadata ?? {};
    const license = text(m.LicenseShortName?.value);
    if (info && FREE.test(license)) r.photo = { src: p.thumbnail.source.split("?")[0], author: text(m.Artist?.value).replace(/[^ ]+@[^ ]+|(https?:[^ ]+|www[^ ]+)/g, "").replace(/ +/g, " ").trim().slice(0, 80) || "Unknown author", license, licenseUrl: m.LicenseUrl?.value ?? null, page: info.descriptionurl };
  }
  return out;
}

const cases = {}, problems = [], kinds = {}, titles = {};
const files = readdirSync("data/cases").filter((f) => f.endsWith(".json") && !f.startsWith("_"));
const wanted = files.map((f) => {
  const c = JSON.parse(readFileSync(`data/cases/${f}`, "utf8"));
  const links = PEOPLE[c.slug]?.map(([t, role]) => [t, role, "person"]) ?? (ORGS[c.actor_name] ? [[ORGS[c.actor_name], c.actor_name === "Segment" ? "Now owns Segment" : "Organisation or place in this case", "organisation"]] : []);
  titles[c.slug] = c.title;
  for (const [t, , k] of links) kinds[t] = k;
  return [c.slug, links];
});
const profiles = await buildProfiles(kinds);
for (const [slug, links] of wanted)
  for (const [t, role] of links) {
    if (profiles[t].error) problems.push(`${slug}: ${t}: ${profiles[t].error}`);
    else (cases[slug] ??= []).push({ id: t, role });
  }
for (const s of Object.keys(PEOPLE)) if (!files.includes(s + ".json")) problems.push("unknown slug " + s);
for (const [t, p] of Object.entries(profiles)) if (p.error) delete profiles[t];
mkdirSync("src/data", { recursive: true });
writeFileSync("src/data/profiles.json", JSON.stringify({ retrievedAt: new Date().toISOString().slice(0, 10), profiles, cases, titles }, null, 1) + "\n");
console.log("profiles", Object.keys(profiles).length, "with photo", Object.values(profiles).filter((p) => p.photo).length, "cases", Object.keys(cases).length, "/", files.length);
console.log(problems.join("\n"));
for (const [t, p] of Object.entries(profiles)) console.log(p.kind[0], p.photo ? "photo " + p.photo.license : "-----", "|", t, "|", p.description, "|", p.born ?? p.founded ?? "");
