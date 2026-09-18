import { STATE_CODES, type StateCode } from "./localData";

export const LABOUR_SOURCE =
  "https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/latest-release";
export const LABOUR_STATES: Record<StateCode, string> = {
  NSW: "New South Wales",
  VIC: "Victoria",
  QLD: "Queensland",
  SA: "South Australia",
  WA: "Western Australia",
  TAS: "Tasmania",
  NT: "Northern Territory",
  ACT: "Australian Capital Territory",
};
export type LabourObservation = {
  state: StateCode;
  employedPeople: number;
  employmentMonthlyPercent: number;
  unemploymentPercent: number;
  participationPercent: number;
};
export type StateLabour = {
  status: "available" | "unavailable";
  period: string | null;
  retrievedAt: string | null;
  sourceUrl: string;
  observations: LabourObservation[];
};
export function labourState(query: string): StateCode | undefined {
  return STATE_CODES.find((state) =>
    [state, LABOUR_STATES[state]].some((name) => name.toLowerCase() === query.trim().toLowerCase())
  );
}
export function labourHref(state: StateCode, period: string) {
  return `/markets?q=${encodeURIComponent(LABOUR_STATES[state])}&labourPeriod=${encodeURIComponent(period)}#state-labour`;
}
/** Exact requested months only. Never substitute the latest release for history. */
export function readStateLabour(
  data: StateLabour | undefined,
  state: string,
  asOf: string,
  period?: string | null
) {
  if (
    data?.status !== "available" ||
    !data.period ||
    !/^20\d{2}-(0[1-9]|1[0-2])$/.test(data.period)
  )
    return null;
  if (period != null && period !== data.period) return null;
  const now = new Date(asOf);
  if (!Number.isFinite(now.getTime())) return null;
  const [year, month] = data.period.split("-").map(Number);
  const age = now.getUTCFullYear() * 12 + now.getUTCMonth() - (year! * 12 + month! - 1);
  // Official monthly release lag, with an explicit stale boundary.
  if (age < 1 || (!period && age > 3)) return null;
  return data.observations.find((row) => row.state === state) ?? null;
}
