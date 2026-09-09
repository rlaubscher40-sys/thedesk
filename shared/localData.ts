/** Source-scoped identifiers are deliberate: a postcode, SA2 and LGA are not interchangeable. */
export const LOCAL_SOURCE_KEYS = [
  "abs-sa2-population",
  "nsw-bond-rents",
  "qld-bond-rents",
] as const;
export type LocalSourceKey = (typeof LOCAL_SOURCE_KEYS)[number];
export const STATE_CODES = [
  "NSW",
  "VIC",
  "QLD",
  "SA",
  "WA",
  "TAS",
  "NT",
  "ACT",
] as const;
export type StateCode = (typeof STATE_CODES)[number];
export type LocalObservation = {
  measure:
    | "population"
    | "population-change"
    | "population-growth"
    | "natural-increase"
    | "internal-migration"
    | "overseas-migration"
    | "weekly-rent";
  value: number | null;
  unit: "people" | "%" | "AUD/week";
  period: string;
  category: string;
  sample: number | null;
  status: "published" | "suppressed" | "insufficient-sample";
};
export type LocalArea = {
  id: string;
  name: string;
  state: StateCode;
  kind: "SA2" | "postcode" | "suburb" | "LGA" | "state";
  boundaryVersion: string;
  observations: LocalObservation[];
};
export type LocalDataset = {
  sourceKey: LocalSourceKey;
  period: string;
  resourceUrl: string;
  fingerprint: string;
  retrievedAt: string;
  areas: LocalArea[];
  excludedRows: number;
};
export const LOCAL_SOURCES = {
  "abs-sa2-population": {
    label: "ABS local population",
    publisher: "Australian Bureau of Statistics",
    url: "https://www.abs.gov.au/statistics/people/population/regional-population/latest-release",
    licence: "https://www.abs.gov.au/website-privacy-copyright-and-disclaimer",
    attribution:
      "Australian Bureau of Statistics, Regional population (CC BY 4.0)",
    cadence: "Annual",
    states: [...STATE_CODES],
    maxAgeMonths: 27,
    method:
      "Estimated resident population on ASGS Edition 3 (2021) SA2 boundaries. SA2s are statistical areas, not necessarily suburbs. Migration components cover the financial year ending in the reference year. Do not substitute an SA2 for a whole city or suburb.",
  },
  "nsw-bond-rents": {
    label: "NSW new-bond weekly rents",
    publisher: "NSW Fair Trading",
    url: "https://www.nsw.gov.au/housing-and-construction/rental-forms-surveys-and-data/rental-bond-data",
    licence: "https://data.nsw.gov.au/data/dataset/rental-bond-lodgement",
    attribution:
      "NSW Fair Trading rental bond lodgements; medians calculated by The Desk",
    cadence: "Monthly",
    states: ["NSW"],
    maxAgeMonths: 3,
    method:
      "Median weekly rent calculated from published bond lodgements for the stated postcode, dwelling type and bedrooms. At least 10 valid rents are required. Unknown values and other/unknown dwelling types are excluded. Postcodes are not suburbs. This is not vacancy, asking rent or rent paid by all existing tenants.",
  },
  "qld-bond-rents": {
    label: "Queensland new-bond weekly rents",
    publisher: "Queensland Residential Tenancies Authority",
    url: "https://www.rta.qld.gov.au/forms-resources/rta-data-releases/median-rents-quarterly-data",
    licence: "https://creativecommons.org/licenses/by/4.0/",
    attribution:
      "Queensland Residential Tenancies Authority, bond statistics; CC BY 4.0 as specified in the workbook",
    cadence: "Quarterly",
    states: ["QLD"],
    maxAgeMonths: 6,
    method:
      "Publisher median weekly rent for new tenancies by source-defined suburb, postcode, LGA or state and dwelling category. Bonds lodged are shown as contextual counts, not a confirmed median sample. Suppressed medians remain missing. Compare year-on-year; do not infer vacancy or all-tenancy rents.",
  },
} satisfies Record<
  LocalSourceKey,
  {
    label: string;
    publisher: string;
    url: string;
    licence: string;
    attribution: string;
    cadence: string;
    states: readonly string[];
    maxAgeMonths: number;
    method: string;
  }
>;

export function normaliseArea(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
export function localDatasetIsOlder(
  data: Pick<LocalDataset, "period" | "sourceKey">,
  now: Date,
): boolean {
  const month =
    Number(data.period.slice(0, 4)) * 12 + Number(data.period.slice(5, 7));
  return (
    now.getUTCFullYear() * 12 + now.getUTCMonth() + 1 - month >
    LOCAL_SOURCES[data.sourceKey].maxAgeMonths
  );
}
export function localAreaHref(
  area: Pick<LocalArea, "name" | "state" | "kind">,
): string {
  return `/markets?q=${encodeURIComponent(area.name)}&state=${area.state}&areaKind=${area.kind}#local-data`;
}
export function localPeriodLabel(
  source: LocalSourceKey,
  period: string,
  measure?: LocalObservation["measure"],
): string {
  const date = new Date(`${period}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return period;
  if (source === "nsw-bond-rents")
    return date.toLocaleDateString("en-AU", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  const label = date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return source === "qld-bond-rents"
    ? `Quarter ended ${label}`
    : measure === "population"
      ? label
      : `Year to ${label}`;
}
