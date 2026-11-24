/** Builds an all-day calendar reminder (RFC 5545) for a decision review. Pure, so it is unit tested. */

/** Escapes TEXT values so a title can't break out of its property. */
function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

/** Folds content lines at 75 octets without splitting a character. */
function fold(line: string): string {
  const enc = new TextEncoder();
  let out = "";
  let size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (size + n > 75) {
      out += "\r\n ";
      size = 1;
    }
    out += ch;
    size += n;
  }
  return out;
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
const day = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

export function reviewIcs(x: { id: string; title: string; due: Date; url: string; now: Date }): string {
  const end = new Date(x.due.getTime() + 24 * 60 * 60 * 1000);
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//DecisionTrail//Review reminder//EN",
      "BEGIN:VEVENT",
      `UID:${x.id}@decisiontrail`,
      `DTSTAMP:${stamp(x.now)}`,
      `DTSTART;VALUE=DATE:${day(x.due)}`,
      `DTEND;VALUE=DATE:${day(end)}`,
      `SUMMARY:${escapeText(`Review your decision: ${x.title}`)}`,
      `DESCRIPTION:${escapeText(`What actually happened? Record the outcome: ${x.url}`)}`,
      `URL:${x.url}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Decision review due",
      "TRIGGER:PT9H",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(fold)
      .join("\r\n") + "\r\n"
  );
}
