import { describe, expect, it } from "vitest";
import { reviewIcs } from "./ics";

const base = { id: "abc", due: new Date("2026-12-31T00:00:00Z"), url: "https://x.test/decisions/abc", now: new Date("2026-11-24T10:00:00Z") };

describe("reviewIcs", () => {
  it("creates an all-day event on the review date", () => {
    const s = reviewIcs({ ...base, title: "Pricing" });
    expect(s).toContain("DTSTART;VALUE=DATE:20261231\r\n");
    expect(s).toContain("DTEND;VALUE=DATE:20270101\r\n");
    expect(s).toContain("DTSTAMP:20261124T100000Z\r\n");
  });

  it("escapes titles so they cannot inject properties", () => {
    const s = reviewIcs({ ...base, title: "A, b; c\r\nATTENDEE:evil" });
    expect(s).toContain("A\\, b\\; c\\nATTENDEE:evil");
    expect(s).not.toMatch(/^ATTENDEE/m);
  });

  it("folds long lines to 75 octets", () => {
    const s = reviewIcs({ ...base, title: "\u1019".repeat(120) });
    for (const l of s.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
});
