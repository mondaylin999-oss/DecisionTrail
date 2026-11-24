import { describe, expect, it } from "vitest";
import { cleanSnippet, isAllowedReferenceUrl, parseSearch, searchApiUrl, wikiUrl } from "./wikipedia";

describe("wikipedia helpers", () => {
  it("strips markup and decodes entities in snippets", () => {
    expect(cleanSnippet('Netflix <span class="searchmatch">Qwikster</span> &quot;split&quot; &amp; reversal')).toBe('Netflix Qwikster "split" & reversal');
  });

  it("builds a safe article url", () => {
    expect(wikiUrl("AT&T Inc.")).toBe("https://en.wikipedia.org/wiki/AT%26T_Inc.");
  });

  it("encodes the query in the api url", () => {
    expect(searchApiUrl("a b&c")).toContain("srsearch=a+b%26c");
  });

  it("parses results and ignores malformed rows", () => {
    const json = { query: { search: [{ title: "Qwikster", snippet: "<b>x</b>" }, { snippet: "no title" }, 7] } };
    expect(parseSearch(json)).toEqual([{ title: "Qwikster", url: "https://en.wikipedia.org/wiki/Qwikster", snippet: "x", publisher: "Wikipedia" }]);
    expect(parseSearch(null)).toEqual([]);
    expect(parseSearch({ query: {} })).toEqual([]);
  });

  it("only allows https wikipedia urls", () => {
    expect(isAllowedReferenceUrl("https://en.wikipedia.org/wiki/X")).toBe(true);
    expect(isAllowedReferenceUrl("http://en.wikipedia.org/wiki/X")).toBe(false);
    expect(isAllowedReferenceUrl("https://evilwikipedia.org/x")).toBe(false);
    expect(isAllowedReferenceUrl("https://wikipedia.org.evil.com/x")).toBe(false);
    expect(isAllowedReferenceUrl("not a url")).toBe(false);
  });
});
