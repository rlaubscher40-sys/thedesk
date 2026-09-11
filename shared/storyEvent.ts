import type { SourceTiming } from "./sourceTiming";

export type EventStory = { title: string; channel?: string; sourceTiming?: SourceTiming | null };
const places: [string, RegExp][] = [
  ["nsw", /\b(?:NSW|New South Wales)\b/i],
  ["vic", /\bVictoria(?:n)?\b/i],
  ["qld", /\bQueensland(?:ers?)?\b/i],
  ["wa", /\bWestern Australia\b/i],
  ["sa", /\bSouth Australia\b/i],
  ["tas", /\bTasmania\b/i],
  ["nt", /\bNorthern Territory\b/i],
  ["act", /\bACT\b/],
  ...[
    "Sydney",
    "Melbourne",
    "Brisbane",
    "Adelaide",
    "Perth",
    "Hobart",
    "Darwin",
    "Canberra",
    "Gold Coast",
    "Sunshine Coast",
    "Townsville",
    "Cairns",
    "Geelong",
    "Shepparton",
    "Ballarat",
    "Bendigo",
    "Toowoomba",
    "Rockhampton",
    "Wollongong",
    "Newcastle",
    "Mildura",
  ].map((place) => [place.toLowerCase(), new RegExp(`\\b${place}\\b`, "i")] as [string, RegExp]),
];
const setEqual = (a: Set<string>, b: Set<string>) =>
  a.size === b.size && [...a].every((x) => b.has(x));
export function numericClaims(text: string): Set<string> {
  return new Set(
    (
      text
        .replace(/(?<=\d),(?=\d{3}\b)/g, "")
        .match(
          /(?:[$€£]\s*)?[+-]?\b\d+(?:\.\d+)?(?:\s*(?:%|(?:per cent|basis points|million|billion|trillion|bn|[mb])\b))?/gi
        ) ?? []
    ).map((value) => value.toLowerCase().replace(/\s+/g, ""))
  );
}
// Reuse ICU state: clustering can compare thousands of pairs per run.
const originalDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Sydney",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function originalPublicationDay(story: EventStory): string | null {
  const timing = story.sourceTiming;
  if (timing?.publisherDateStatus !== "available") return null;
  if (timing.publisherPublishedDay) return timing.publisherPublishedDay;
  if (!timing.publisherPublishedAt) return null;
  const date = new Date(timing.publisherPublishedAt);
  return Number.isFinite(date.getTime()) ? originalDayFormatter.format(date) : null;
}

export function conflictingLocations(a: string, b: string): boolean {
  const region = (s: string) => new Set(places.filter(([, p]) => p.test(s)).map(([name]) => name));
  const ap = region(a), bp = region(b);
  return !!(ap.size && bp.size && !setEqual(ap, bp));
}

/** Similar words do not prove the same event. These are conservative vetoes,
 * not an entity extractor or a claim that every remaining pair is identical. */
export function conflictingEvents(a: EventStory, b: EventStory): boolean {
  const aDay = originalPublicationDay(a),
    bDay = originalPublicationDay(b);
  if (aDay && bDay && aDay !== bDay) return true;
  if (conflictingLocations(a.title, b.title)) return true;
  const an = numericClaims(a.title),
    bn = numericClaims(b.title);
  if (an.size && bn.size && !setEqual(an, bn)) return true;
  const months = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .match(
          /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/g
        ) ?? []
    );
  const am = months(a.title),
    bm = months(b.title);
  if (am.size && bm.size && !setEqual(am, bm)) return true;
  const direction = (s: string) => {
    const up = /\b(?:rise[sn]?|rising|rose|increase[sd]?|grew|growth|climbs?|surges?)\b/i.test(s);
    const down =
      /\b(?:falls?|falling|fell|decline[sd]?|decrease[sd]?|drops?|dropped|cuts?|cutting)\b/i.test(
        s
      );
    return up === down ? 0 : up ? 1 : -1;
  };
  return direction(a.title) * direction(b.title) === -1;
}
