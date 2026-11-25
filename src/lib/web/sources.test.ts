import { describe, expect, it } from "vitest";
import { abstractText, htmlToText, isLiveSourceUrl, parseHackerNews, parseIntros, parseOpenAlex, parseStackExchange, relevant, safeCorrection, topicWords, trimWords, withStackSummaries } from "./sources";

describe("topicWords", () => {
  it("puts the question's subject first", () => {
    expect(topicWords("i am CS student attending second year.should i take intenship program?")).toEqual(["intenship", "student"]);
  });

  it("drops names, numbers, emails and links", () => {
    const w = topicWords("My boss Sarah at Acme pays 120000, mail me@x.com or https://x.com. Should I quit my job?", [], 10);
    expect(w).toContain("quit");
    for (const s of ["sarah", "acme", "120000", "x"]) expect(w).not.toContain(s);
    expect(w.join(" ")).not.toMatch(/@|http/);
  });

  it("uses typed options", () => {
    expect(topicWords("Which one?", ["Monolith", "microservices"])).toEqual(["monolith", "microservices"]);
  });
});

describe("parsing", () => {
  it("reads OpenAlex works", () => {
    const [r] = parseOpenAlex({ results: [{ id: "https://openalex.org/W1", doi: "https://doi.org/10.1/x", display_name: "Do <i>Internships</i> Pay Off?", publication_year: 2020, cited_by_count: 91, abstract_inverted_index: { pay: [1], Internships: [0] } }, { display_name: "no link" }] });
    expect(r).toMatchObject({ kind: "study", title: "Do Internships Pay Off?", url: "https://doi.org/10.1/x", snippet: "Internships pay", detail: "2020 · cited 91 times" });
    expect(parseOpenAlex(null)).toEqual([]);
  });

  it("limits abstracts and survives bad data", () => {
    expect(abstractText({ Abstract: [0], a: [1], b: [99999] })).toBe("a");
    expect(abstractText("x")).toBe("");
  });

  it("reads discussions", () => {
    expect(parseStackExchange({ items: [{ title: "A &amp; B", link: "https://workplace.stackexchange.com/q/1", answer_count: 2, score: 5 }] }, "workplace")[0].title).toBe("A & B");
    expect(parseHackerNews({ hits: [{ title: "T", objectID: "1", num_comments: 0 }, { title: "U", objectID: "2", num_comments: 9, created_at: "2021-01-01" }] }).map((x) => x.title)).toEqual(["U"]);
  });
});

describe("summaries", () => {
  const count = (t: string) => t.split(/\s+/).length;

  it("never exceeds the word limit and prefers whole sentences", () => {
    expect(trimWords("One two three. Four five", 4)).toBe("One two three.");
    expect(trimWords("a b c d e", 3)).toBe("a b c…");
    expect(trimWords("short text")).toBe("short text");
  });

  it("turns post HTML into plain text", () => {
    expect(htmlToText("<p>One &amp; two</p><pre><code>x()</code></pre><ul><li>It&#39;s&#x2F;ok</li></ul>")).toBe("One & two It's/ok");
  });

  it("joins the question with its highest-scored answer within 150 words", () => {
    const body = `<p>${"word ".repeat(300)}</p>`;
    const rows = parseStackExchange({ items: [{ title: "T", link: "https://workplace.stackexchange.com/q/1", question_id: 1, answer_count: 1, score: 0, body }] }, "workplace");
    const [r] = withStackSummaries(rows, { items: [{ question_id: 1, score: 1, body: "low" }, { question_id: 1, score: 9, body: `<p>best ${"answer ".repeat(300)}</p>` }] });
    expect(r.snippet).toMatch(/^Question: word.*Top answer: best/);
    expect(count(r.snippet)).toBeLessThanOrEqual(150);
    expect(r).not.toHaveProperty("body");
    expect(r.detail).toBe("1 answer · score 0");
    expect(count(withStackSummaries(rows, null)[0].snippet)).toBeLessThanOrEqual(150);
  });

  it("reads Wikipedia introductions", () => {
    expect(parseIntros({ query: { pages: { 1: { title: "A", extract: "Intro." }, 2: { title: "B" } } } })).toEqual(new Map([["A", "Intro."]]));
    expect(parseIntros(null).size).toBe(0);
  });
});

describe("relevance and safety", () => {
  it("keeps only on-topic titles, best first", () => {
    const rows = ["Cats", "Student life", "Student internship experiences"].map((title) => ({ title }));
    expect(relevant(rows, "internship student", 5).map((r) => r.title)).toEqual(["Student internship experiences"]);
    expect(relevant([{ title: "An explanation of plants" }], "plan", 5)).toEqual([]);
  });

  it("corrects clear typos only", () => {
    expect(safeCorrection("intenship student", "internship student", 2)).toBe("internship student");
    expect(safeCorrection("move abroad job", "movie abroad job", 2)).toBe("move abroad job");
    expect(safeCorrection("keep renting", "keep reading", 2)).toBe("keep renting");
    expect(safeCorrection("intenship", "internship", 500)).toBe("intenship");
  });

  it("allows only known https hosts", () => {
    expect(isLiveSourceUrl("https://doi.org/10.1/x")).toBe(true);
    expect(isLiveSourceUrl("https://workplace.stackexchange.com/q/1")).toBe(true);
    expect(isLiveSourceUrl("https://evil-doi.org/x")).toBe(false);
    expect(isLiveSourceUrl("http://doi.org/x")).toBe(false);
  });
});
