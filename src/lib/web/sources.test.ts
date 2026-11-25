import { describe, expect, it } from "vitest";
import { abstractText, findingsOf, htmlToText, isLiveSourceUrl, parseCrossref, parseHackerNews, parseIntros, parseOpenAlex, parseStackExchange, relevant, safeCorrection, studyQuestion, topicWords, trimWords, withStackAnswers } from "./sources";

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
    expect(r).toMatchObject({ kind: "study", title: "Do Internships Pay Off?", url: "https://doi.org/10.1/x", snippet: "No clear result is stated. About the study: Internships pay", question: "Do Internships Pay Off?", detail: "2020 · cited 91 times" });
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

describe("Crossref backup", () => {
  it("keeps English, cited articles with an abstract", () => {
    const abstract = `<jats:title>Abstract</jats:title><jats:p>We looked at the work of the students. Results show that the pay of the interns was higher in the end. ${"This is the rest of the text. ".repeat(6)}</jats:p>`;
    const ok = { DOI: "10.1/x", title: ["Student internships"], abstract, "is-referenced-by-count": 4, issued: { "date-parts": [[2020]] } };
    const [r, ...rest] = parseCrossref({ message: { items: [ok, { ...ok, "is-referenced-by-count": 0 }, { ...ok, abstract: "<jats:p>" + "penelitian ini bertujuan mahasiswa ".repeat(20) + "</jats:p>" }, { ...ok, DOI: "bad" }] } });
    expect(rest).toEqual([]);
    expect(r).toMatchObject({ url: "https://doi.org/10.1/x", publisher: "Crossref", detail: "2020 · cited 4 times" });
    expect(r.snippet).toMatch(/^Results show/);
    expect(parseCrossref(null)).toEqual([]);
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

  it("pairs the question with an answer, each within 150 words", () => {
    const item = (id: number) => ({ title: "T", link: `https://workplace.stackexchange.com/q/${id}`, question_id: id, answer_count: 1, score: 0, body: `<p>${"asked ".repeat(300)}</p>`, owner: { display_name: "A &amp; B", link: "https://workplace.stackexchange.com/users/1/a" }, content_license: "CC BY-SA 4.0" });
    const rows = parseStackExchange({ items: [item(1), item(2), item(3)] }, "workplace");
    const out = withStackAnswers(rows, {
      items: [
        { question_id: 1, score: 9, body: `<p>${"general ".repeat(300)}</p>` },
        { question_id: 2, score: 9, body: "<p>You should simply ask them and then wait for a reply.</p>" },
        { question_id: 2, score: 6, body: "<p>In my experience I took the offer and it led to a job.</p>" },
        { question_id: 3, score: -2, body: "<p>A badly rated answer that nobody should rely on at all.</p>" },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0].snippet).toMatch(/^general/);
    expect(count(out[0].snippet)).toBeLessThanOrEqual(150);
    expect(out[0].question).toMatch(/^asked/);
    expect(count(out[0].question!)).toBeLessThanOrEqual(150);
    expect(out[1].snippet).toContain("it led to a job");
    expect(out[0].credits).toEqual([
      { role: "Question", name: "A & B", url: "https://workplace.stackexchange.com/users/1/a", licence: "CC BY-SA 4.0" },
      { role: "Answer", name: "a former user", licence: "CC BY-SA" },
    ]);
    expect(out[0].detail).toBe("1 answer · score 0");
    expect(withStackAnswers(rows, null)).toEqual([]);
  });

  it("finds the result in an abstract and never presents a goal as one", () => {
    expect(findingsOf("We study internships. Using German data we compare groups. Results show that internships increase earnings by six percent. The effect is larger for men.")).toBe("Results show that internships increase earnings by six percent. The effect is larger for men.");
    expect(findingsOf("Purpose The purpose of this study was to find out whether x works. Findings The internship raised confidence. Originality/value This is new.")).toBe("The internship raised confidence.");
    expect(findingsOf("This paper aims to show whether internships matter.")).toBeNull();
    expect(findingsOf("")).toBeNull();
  });

  it("takes a study's question from its stated aim, otherwise its title", () => {
    expect(studyQuestion("Purpose The purpose of this study was to explore internship experiences. Findings The students learned a lot.", "T")).toBe("The purpose of this study was to explore internship experiences.");
    expect(studyQuestion("Work has changed. We study the causal effect of internships on earnings. We find large returns.", "T")).toBe("We study the causal effect of internships on earnings.");
    expect(studyQuestion("Results show that pay rose.", "Do internships pay?")).toBe("Do internships pay?");
    expect(studyQuestion("", "Do internships pay?")).toBe("Do internships pay?");
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
