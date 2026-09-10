/** Source-scoped identifiers are deliberate: a postcode, SA2 and LGA are not interchangeable. */
export const LOCAL_SOURCE_KEYS = [
  "abs-sa2-population",
  "nsw-bond-rents",
  "qld-bond-rents",
  "sa-bond-rents",
  "wa-bond-rents",
  "tas-bond-rents",
  "vic-bond-rents",
] as const;
/** Reviewed VIC file only: automatic publisher downloads have not succeeded. */
export const AUTOMATIC_LOCAL_SOURCE_KEYS = LOCAL_SOURCE_KEYS.filter(source => source !== "vic-bond-rents");
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
  status: "published" | "suppressed" | "insufficient-sample" | "source-unavailable";
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
  downloadCache?: {
    resourceUrl: string;
    finalUrl: string;
    parserVersion: string;
    downloadedAt: string;
    bodyBytes?: number;
    etag?: string;
    lastModified?: string;
  };
  provenance?: "reviewed-release";
  acquisition?: "user-upload";
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
  "vic-bond-rents": {
    label: "Victoria quarterly LGA weekly rents",
    publisher: "Homes Victoria / Department of Families, Fairness and Housing",
    url: "https://www.dffh.vic.gov.au/publications/rental-report",
    licence: "https://discover.data.vic.gov.au/dataset/rental-report-quarterly-quarterly-median-rents-by-lga",
    attribution: "Homes Victoria, Quarterly median rents by Local Government Area, September 2025 (CC BY 4.0); supplied publisher workbook",
    cadence: "Quarterly",
    states: ["VIC"],
    maxAgeMonths: 6,
    method: "Publisher median weekly rents for new rental lettings by council and the stated dwelling/bedroom category. Reported counts are contextual. Source dashes mean no numeric figure is supplied; the specific reason is not stated in this workbook. Do not infer zero or reconstruct missing values from totals. Published small counts can be volatile. Five quarters from September 2024 to September 2025 are stored. These historical figures are not current asking rents, vacancy rates or rents paid by all existing tenants. Council boundaries are not suburbs; Melbourne LGA is not metropolitan Melbourne. Changes in medians are affected by the mix of lettings and are not the publisher's rent index.",
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
  "sa-bond-rents": {
    label: "South Australia new-bond weekly rents",
    publisher: "SA Housing Trust",
    url: "https://data.sa.gov.au/data/dataset/private-rent-report",
    licence: "https://data.sa.gov.au/data/dataset/private-rent-report",
    attribution:
      "SA Housing Trust, Private Rental Report (Creative Commons Attribution)",
    cadence: "Quarterly",
    states: ["SA"],
    maxAgeMonths: 6,
    method:
      "Publisher median weekly rents for new bonds by suburb, postcode and dwelling category. Counts are rounded to the nearest five and counts of one to five are suppressed. The Desk withholds medians when the displayed count is below 15 or suppressed. Postcodes split across source regions are excluded because component medians cannot be combined. These are not asking rents or vacancy rates.",
  },
  "wa-bond-rents": {
    label: "WA new-bond weekly rents",
    publisher: "Government of Western Australia",
    url: "https://housing-data-exchange.ahdap.org/dataset/west-australia-rental-bonds-data-2023-current",
    licence: "https://creativecommons.org/licenses/by/4.0/",
    attribution:
      "Government of Western Australia rental bonds (CC BY 4.0); medians calculated by The Desk",
    cadence: "Monthly",
    states: ["WA"],
    maxAgeMonths: 3,
    method:
      "Median weekly rent calculated from published monthly bond lodgements by postcode. All dwelling types and bedrooms are combined because the source does not distinguish them. At least ten valid rents are required. Postcodes are not suburbs. This is not asking rent, vacancy or rent paid by all existing tenants.",
  },
  "tas-bond-rents": {
    label: "Tasmania new-bond weekly rents",
    publisher: "Tasmanian Department of Justice",
    url: "https://data.gov.au/data/organization/department-of-justice-tasmania",
    licence: "https://creativecommons.org/licenses/by/4.0/",
    attribution:
      "Tasmanian Department of Justice rental bond data (CC BY 4.0); medians calculated by The Desk",
    cadence: "Monthly",
    states: ["TAS"],
    maxAgeMonths: 3,
    method:
      "Median weekly rent for private-housing bonds in the publisher's monthly Active Bonds sheet, lodged during that month, by postcode, dwelling type and bedrooms. Closed bonds are excluded. At least ten valid rents are required. This is a subset of new bonds, not all active tenancies, asking rents or vacancy.",
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
  period?: string,
): string {
  return `/markets?q=${encodeURIComponent(area.name)}&state=${area.state}&areaKind=${area.kind}${period ? `&period=${encodeURIComponent(period)}` : ""}#local-data`;
}
export function localPeriodLabel(
  source: LocalSourceKey,
  period: string,
  measure?: LocalObservation["measure"],
): string {
  const date = new Date(`${period}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return period;
  if (["nsw-bond-rents", "wa-bond-rents", "tas-bond-rents"].includes(source))
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
  return ["qld-bond-rents", "sa-bond-rents", "vic-bond-rents"].includes(source)
    ? `Quarter ended ${label}`
    : measure === "population"
      ? label
      : `Year to ${label}`;
}

export function localSampleLabel(source: LocalSourceKey): string {
  if (source === "abs-sa2-population") return "Sample";
  if (source === "vic-bond-rents") return "Reported count";
  if (["nsw-bond-rents", "wa-bond-rents", "tas-bond-rents"].includes(source))
    return "Valid rents";
  if (source === "sa-bond-rents") return "Bonds (rounded)";
  return "Bonds lodged";
}
