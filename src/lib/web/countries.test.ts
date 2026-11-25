import { describe, expect, it } from "vitest";
import { closestFirst, COUNTRIES, COUNTRY_CODES, countriesOf, mentions, nearbyCountries, placeOf, type Closeness } from "./countries";

const [mm, th, pl, gn, gb] = ["mm", "th", "pl", "gn", "gb"].map((c) => countriesOf([c])[0]);

describe("countries", () => {
  it("has valid, unique codes", () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    expect(COUNTRY_CODES.every((c) => /^[a-z]{2}$/.test(c))).toBe(true);
    expect(COUNTRIES.length).toBeGreaterThan(190);
    expect(countriesOf(["zz"])).toEqual([]);
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
