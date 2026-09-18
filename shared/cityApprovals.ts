export const APPROVAL_REGIONS = {
  "1GSYD": "Sydney",
  "2GMEL": "Melbourne",
  "3GBRI": "Brisbane",
  "4GADE": "Adelaide",
  "5GPER": "Perth",
  "6GHOB": "Hobart",
  "7GDAR": "Darwin",
  "8ACTE": "Canberra",
} as const;
export function approvalGeography(city: string) {
  return city === "Canberra" ? "Australian Capital Territory" : `Greater ${city}`;
}
export const APPROVAL_SOURCE =
  "https://www.abs.gov.au/statistics/industry/building-and-construction/building-approvals-australia/latest-release";
export const APPROVAL_FLOW = "ABS:BA_GCCSA(1.0.0)";
export type ApprovalObservation = {
  city: string;
  period: string;
  dwellings: number | null;
  status: string;
};
export type CityApprovals = {
  status: "available" | "unavailable";
  retrievedAt: string | null;
  observations: ApprovalObservation[];
};

export function approvalsDataUrl(asOf: string): string {
  const start = new Date(`${asOf.slice(0, 7)}-01T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - 14);
  return `https://data.api.abs.gov.au/rest/data/ABS,BA_GCCSA,1.0.0/1.1.9.TOT.TOT.10.${Object.keys(APPROVAL_REGIONS).join("+")}.M?startPeriod=${start.toISOString().slice(0, 7)}&format=csv`;
}

/** Sum only twelve consecutive observed months. Missing/suppressed is never zero. */
export function cityApprovalHref(city: string, period: string): string {
  return `/markets?q=${encodeURIComponent(city)}&approvalPeriod=${encodeURIComponent(period)}#housing-approvals`;
}
export function annualApprovals(data: CityApprovals | undefined, city: string, asOf: string, period?: string | null) {
  if (
    data?.status !== "available" ||
    !Object.values(APPROVAL_REGIONS).some((name) => name === city) ||
    !Number.isFinite(Date.parse(asOf)) ||
    (period != null && !/^20\d{2}-(0[1-9]|1[0-2])$/.test(period))
  )
    return null;
  const rows = data.observations
    .filter((row) => row.city === city && (period == null || row.period <= period))
    .sort((a, b) => b.period.localeCompare(a.period));
  const latest = rows[0];
  if (!latest || (period != null && latest.period !== period)) return null;
  const month = (value: string) => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7));
  const age = month(asOf) - month(latest.period);
  if (age < 1 || (period == null && age > 3)) return null;
  const year = rows.slice(0, 12);
  if (
    year.length !== 12 ||
    year.some(
      (row, index) => row.dwellings === null || month(latest.period) - month(row.period) !== index
    )
  )
    return null;
  return {
    city,
    period: latest.period,
    total: year.reduce((sum, row) => sum + row.dwellings!, 0),
    preliminary: year.some((row) => row.status === "p"),
    revised: year.some((row) => row.status === "r"),
  };
}
