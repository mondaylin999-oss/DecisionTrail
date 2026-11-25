import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { closestFirst, COUNTRIES, COUNTRY_CODES, countriesOf, locate, mentions, nearbyCountries, placeOf, searchCountries, type Closeness } from "./countries";

const [mm, th, pl, gn, gb] = ["mm", "th", "pl", "gn", "gb"].map((c) => countriesOf([c])[0]);

describe("countries", () => {
  it("has valid, unique codes", () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    expect(COUNTRY_CODES.every((c) => /^[a-z]{2}$/.test(c))).toBe(true);
    expect(COUNTRIES.length).toBeGreaterThan(190);
    expect(countriesOf(["zz"])).toEqual([]);
  });

  it("has a flag file for every country", () => {
    expect(COUNTRY_CODES.filter((c) => !existsSync(`public/flags/${c}.svg`))).toEqual([]);
  });

  it("searches by name, part of a name, other names and without accents", () => {
    const first = (t: string) => searchCountries(t)[0]?.name;
    expect(first("mya")).toBe("Myanmar");
    expect(first("burma")).toBe("Myanmar");
    expect(first("korea")).toMatch(/Korea/);
    expect(first("uk")).toBe("United Kingdom");
    expect(searchCountries("uk").map((c) => c.name)).toContain("Ukraine");
    expect(first("sao tome")).toBe("São Tomé and Príncipe");
    expect(searchCountries("zzzz")).toEqual([]);
    expect(searchCountries(" ")).toHaveLength(COUNTRIES.length);
  });

  it("notices mentions as whole, capitalised words", () => {
    expect(mentions("Thai students abroad", th)).toBe(true);
    expect(mentions("Thailand's schools", th)).toBe(true);
    expect(mentions("how to polish a floor", pl)).toBe(false);
    expect(mentions("Students in Papua New Guinea", gn)).toBe(false);
    expect(mentions("Schools in New South Wales", gb)).toBe(false);
  });

  it("lists other countries of the region as nearby", () => {
    const near = nearbyCountries([mm]).map((c) => c.name);
    expect(near).toContain("Thailand");
    expect(near).not.toContain("Myanmar");
    expect(near).not.toContain("Germany");
  });
});

describe("locate", () => {
  it("prefers the title, then the text, then the authors, and says when nothing is stated", () => {
    expect(locate({ title: "Internships in Vietnam", text: "Also Germany.", authorCountries: ["th"] })).toEqual({ codes: ["vn"], basis: "title" });
    expect(locate({ title: "Internships", text: "Vietnamese universities and German firms." }).codes.sort()).toEqual(["de", "vn"]);
    expect(locate({ title: "Internships", text: "", authorCountries: ["th"] })).toEqual({ codes: ["th"], basis: "authors" });
    expect(locate({ title: "Internships", text: "no place" })).toEqual({ codes: [], basis: "none" });
    expect(locate({ title: "US students", text: "" }).codes).toEqual(["us"]);
    expect(locate({ title: "Tell us about US$ 5 pay", text: "" }).codes).toEqual([]);
  });
});

describe("placeOf", () => {
  it("never claims certainty, whatever the level", () => {
    const cases: [Parameters<typeof placeOf>[0], Closeness][] = [
      [{ title: "Internships in Myanmar", text: "" }, "country"],
      [{ title: "Internships", text: "", authorCountries: ["mm"] }, "authors"],
      [{ title: "Internships", text: "Data from Thailand." }, "nearby"],
      [{ title: "Internships", text: "Data from Germany." }, "world"],
    ];
    for (const [r, level] of cases) {
      const p = placeOf(r, [mm]);
      expect(p.closeness).toBe(level);
      expect(p.text.toLowerCase()).toContain("not ensured");
    }
  });
});

describe("closestFirst", () => {
  const row = (id: number, closeness: Closeness) => ({ id, place: { closeness, text: "" } });
  it("puts the chosen country first and only fills up with farther results", () => {
    const rows = [row(1, "world"), row(2, "nearby"), row(3, "country"), row(4, "authors"), row(5, "world")];
    expect(closestFirst(rows, 3, 5).map((r) => r.id)).toEqual([3, 4, 2]);
    expect(closestFirst([1, 2, 3, 4].map((i) => row(i, "country")), 3, 4)).toHaveLength(4);
    expect(closestFirst([row(1, "world"), row(2, "world")], 3, 5).map((r) => r.id)).toEqual([1, 2]);
  });
});
