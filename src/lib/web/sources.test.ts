import { describe, expect, it } from "vitest";
import { abstractStart, isLiveSourceUrl, parseHackerNews, parseOpenAlex, parseStackExchange, relevant, safeCorrection, topicWords } from "./sources";

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
    expect(abstractStart({ a: [0], b: [99] })).toBe("a");
    expect(abstractStart("x")).toBe("");
  });

  it("reads discussions", () => {
    expect(parseStackExchange({ items: [{ title: "A &amp; B", link: "https://workplace.stackexchange.com/q/1", answer_count: 2, score: 5 }] }, "workplace")[0].title).toBe("A & B");
    expect(parseHackerNews({ hits: [{ title: "T", objectID: "1", num_comments: 0 }, { title: "U", objectID: "2", num_comments: 9, created_at: "2021-01-01" }] }).map((x) => x.title)).toEqual(["U"]);
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
