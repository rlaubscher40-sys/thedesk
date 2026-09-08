export const DEMOGRAPHIC_FLOW = "ABS:ERP_COMP_Q(1.0.0)";
export const DEMOGRAPHIC_SOURCE =
  "https://www.abs.gov.au/statistics/people/population/national-state-and-territory-population/latest-release";
export const DEMOGRAPHIC_REGIONS = {
  "1": "New South Wales",
  "2": "Victoria",
  "3": "Queensland",
  "4": "South Australia",
  "5": "Western Australia",
  "6": "Tasmania",
  "7": "Northern Territory",
  "8": "Australian Capital Territory",
} as const;
export const DEMOGRAPHIC_MEASURES = {
  "6": { name: "netInternalMigration", unitMultiplier: "0" },
  "9": { name: "netOverseasMigration", unitMultiplier: "3" },
  "10": { name: "population", unitMultiplier: "3" },
} as const;

export type DemographicMeasure =
  (typeof DEMOGRAPHIC_MEASURES)[keyof typeof DEMOGRAPHIC_MEASURES]["name"];
export type DemographicObservation = {
  state: string;
  measure: DemographicMeasure;
  period: string;
  people: number | null;
  status: string;
};
export type StateDemographics = {
  status: "available" | "unavailable";
  retrievedAt: string | null;
  observations: DemographicObservation[];
};

function quarterIndex(period: string): number | null {
  const match = period.match(/^(\d{4})-Q([1-4])$/);
  return match ? Number(match[1]) * 4 + Number(match[2]) - 1 : null;
}
function periodFromQuarter(index: number): string {
  return `${Math.floor(index / 4)}-Q${(index % 4) + 1}`;
}

export function demographicsDataUrl(asOf: string): string {
  const date = new Date(asOf);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid demographic retrieval date");
  const currentQuarter = date.getUTCFullYear() * 4 + Math.floor(date.getUTCMonth() / 3);
  // Seven quarters back is required just before a release: the latest official
  // quarter can lag the current one by three, and annual change needs its t-4.
  const start = periodFromQuarter(currentQuarter - 7);
  return `https://data.api.abs.gov.au/rest/data/ABS,ERP_COMP_Q,1.0.0/6+9+10.${Object.keys(DEMOGRAPHIC_REGIONS).join("+")}.Q?startPeriod=${start}&format=csv`;
}

/** A state demand context. Every input remains state-level; no city attribution. */
export function annualStateDemographics(
  data: StateDemographics | undefined,
  state: string,
  asOf: string
) {
  if (
    data?.status !== "available" ||
    !Object.values(DEMOGRAPHIC_REGIONS).some((name) => name === state)
  )
    return null;
  const asOfDate = new Date(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(asOfDate.getTime())) return null;
  const currentQuarter = asOfDate.getUTCFullYear() * 4 + Math.floor(asOfDate.getUTCMonth() / 3);
  const rows = data.observations.filter((row) => row.state === state);
  const latestPeriod = rows
    .map((row) => row.period)
    .sort()
    .at(-1);
  const latestQuarter = latestPeriod ? quarterIndex(latestPeriod) : null;
  // Population components arrive with a long official publication lag. Three
  // quarters is current before the next scheduled release; four is stale.
  if (
    !latestPeriod ||
    latestQuarter === null ||
    currentQuarter - latestQuarter < 1 ||
    currentQuarter - latestQuarter > 3
  )
    return null;
  const find = (measure: DemographicMeasure, period: string) =>
    rows.find((row) => row.measure === measure && row.period === period);
  const populationNow = find("population", latestPeriod);
  const populationBefore = find("population", periodFromQuarter(latestQuarter - 4));
  const componentPeriods = Array.from({ length: 4 }, (_, index) =>
    periodFromQuarter(latestQuarter - index)
  );
  const internal = componentPeriods.map((period) => find("netInternalMigration", period));
  const overseas = componentPeriods.map((period) => find("netOverseasMigration", period));
  const required = [populationNow, populationBefore, ...internal, ...overseas];
  if (required.some((row) => !row || row.people === null)) return null;
  const population = populationNow!.people!;
  const annualChange = population - populationBefore!.people!;
  return {
    state,
    period: latestPeriod,
    population,
    annualChange,
    annualPercent:
      populationBefore!.people! > 0 ? (annualChange / populationBefore!.people!) * 100 : null,
    netInternalMigration: internal.reduce((sum, row) => sum + row!.people!, 0),
    netOverseasMigration: overseas.reduce((sum, row) => sum + row!.people!, 0),
    preliminary: required.some((row) => row!.status === "p"),
    revised: required.some((row) => row!.status === "r"),
  };
}
