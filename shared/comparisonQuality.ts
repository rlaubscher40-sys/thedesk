import type { ComparisonRow, ComparisonSource } from "./marketComparison";

export const COMPARISON_BASIS_LABELS = {
  measure: "Measure",
  period: "Observation period",
  segment: "Property / population type",
  geography: "Geography level",
  unit: "Unit",
} as const;
export type BasisField = keyof typeof COMPARISON_BASIS_LABELS;
export type EvidenceQuality = {
  comparable: boolean;
  reasons: string[];
};
const DAY = 24 * 60 * 60 * 1000;
export const COMPARISON_EVIDENCE_WINDOW_DAYS = 180;
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function normalise(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
/** Literal, bounded tokens; 'house' cannot be extracted from 'warehouse'. */
export function basisTextIsQuoted(value: string, quote: string): boolean {
  const escaped = normalise(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const left = /^[\p{L}\p{N}]/u.test(value) ? "(?<![\\p{L}\\p{N}])" : "";
  const right = /[\p{L}\p{N}]$/u.test(value) ? "(?![\\p{L}\\p{N}])" : "";
  return new RegExp(`${left}${escaped}${right}`, "u").test(normalise(quote));
}

function validUtcDate(year: number, month: number, day: number): number | null {
  const date = new Date(Date.UTC(year, month, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day
    ? date.getTime()
    : null;
}

/** Only unambiguous, explicitly dated endpoints; never borrow a source's publication year. */
export function observationPeriodEnd(period: string): number | null {
  const text = normalise(period);
  const endpoints: Array<{ index: number; value: number | null }> = [];
  for (const iso of text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) {
    endpoints.push({
      index: iso.index,
      value: validUtcDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])),
    });
  }
  for (const month of text.matchAll(
    /\b(?:(\d{1,2})\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})\b/g
  )) {
    const monthIndex = MONTHS.indexOf(month[2]!);
    const year = Number(month[3]);
    const day = month[1]
      ? Number(month[1])
      : new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    endpoints.push({ index: month.index, value: validUtcDate(year, monthIndex, day) });
  }
  for (const quarter of text.matchAll(/\bq([1-4])\s+(20\d{2})\b/g)) {
    endpoints.push({
      index: quarter.index,
      value: Date.UTC(Number(quarter[2]), Number(quarter[1]) * 3, 0),
    });
  }
  if (endpoints.some((endpoint) => endpoint.value == null)) return null;
  return endpoints.sort((a, b) => a.index - b.index).at(-1)?.value ?? null;
}

export function evidenceFreshness(
  date: string,
  asOf: string
): "recent" | "older" | "unknown" | "future" {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timestamp = match
    ? (validUtcDate(Number(match[1]), Number(match[2]) - 1, Number(match[3])) ?? NaN)
    : NaN;
  const reference = Date.parse(asOf);
  if (!Number.isFinite(timestamp) || !Number.isFinite(reference)) return "unknown";
  if (timestamp > reference) return "future";
  return reference - timestamp <= COMPARISON_EVIDENCE_WINDOW_DAYS * DAY ? "recent" : "older";
}

function cadence(quote: string): string {
  const windows = [
    ["annual", /\b(?:annual(?:ly)?|year(?:ly)?|yoy)\b/i],
    ["quarterly", /\b(?:quarter(?:ly)?|qoq)\b/i],
    ["monthly", /\b(?:month(?:ly)?|mom)\b/i],
    ["weekly", /\b(?:week(?:ly)?|wow)\b/i],
  ] as const;
  return windows
    .filter(([, pattern]) => pattern.test(quote))
    .map(([name]) => name)
    .join(",");
}

/** Matching literal criteria are a minimum evidence gate, not an independent audit. */
export function comparisonQuality(
  row: ComparisonRow,
  sources: ComparisonSource[],
  asOf: string
): EvidenceQuality {
  const reasons: string[] = [];
  if (!row.marketA || !row.marketB)
    return { comparable: false, reasons: ["Local evidence is missing on one side."] };
  const observations = [row.marketA, row.marketB];
  const citedSources = observations.map((item) =>
    sources.find((source) => source.ref === item.sourceRef)
  );
  if (citedSources.some((source) => !source)) reasons.push("A cited source is unavailable.");
  else if (citedSources.some((source) => evidenceFreshness(source!.date, asOf) !== "recent"))
    reasons.push("Source dates are older than the evidence window or cannot be verified.");
  const missing: string[] = [];
  const different: string[] = [];
  for (const field of Object.keys(COMPARISON_BASIS_LABELS) as BasisField[]) {
    const a = row.marketA.basis?.[field];
    const b = row.marketB.basis?.[field];
    if (!a || !b) missing.push(COMPARISON_BASIS_LABELS[field].toLowerCase());
    else if (!basisTextIsQuoted(a, row.marketA.quote) || !basisTextIsQuoted(b, row.marketB.quote))
      reasons.push(`${COMPARISON_BASIS_LABELS[field]} is not explicit in the quoted evidence.`);
    else if (normalise(a) !== normalise(b))
      different.push(COMPARISON_BASIS_LABELS[field].toLowerCase());
  }
  if (missing.length) reasons.push(`Not recorded on both sides: ${missing.join(", ")}.`);
  if (different.length) reasons.push(`Different ${different.join(", ")}.`);
  const cadences = observations.map((item) => cadence(item.quote));
  if (cadences.some((value) => value.includes(",")) || cadences[0] !== cadences[1])
    reasons.push("Observation windows differ or contain multiple time horizons.");
  const periods = observations.map((item) =>
    item.basis?.period ? observationPeriodEnd(item.basis.period) : null
  );
  if (periods.some((period) => period == null))
    reasons.push("An explicit observation end date is missing or unrecognised.");
  else if (
    periods.some(
      (period) =>
        period! > Date.parse(asOf) ||
        Date.parse(asOf) - period! > COMPARISON_EVIDENCE_WINDOW_DAYS * DAY
    )
  )
    reasons.push("The observations are older than the evidence window or future-dated.");
  if (
    periods.some(
      (period, index) =>
        period != null && citedSources[index] && period > Date.parse(citedSources[index]!.date)
    )
  )
    reasons.push("An observation endpoint is later than its source publication.");
  return { comparable: reasons.length === 0, reasons };
}
