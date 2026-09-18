import type { StateCode } from "./localData";

export const TRANSFER_SOURCE =
  "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/total-value-dwellings/latest-release";
export const COMPLETION_SOURCE =
  "https://www.abs.gov.au/statistics/industry/building-and-construction/building-activity-australia/latest-release";
export const TRANSFER_AREAS = [
  "Sydney",
  "Rest of NSW",
  "Melbourne",
  "Rest of Vic.",
  "Brisbane",
  "Rest of Qld.",
  "Adelaide",
  "Rest of SA",
  "Perth",
  "Rest of WA",
  "Hobart",
  "Rest of Tas.",
  "Darwin",
  "Rest of NT",
  "Canberra",
] as const;
export type TransferArea = (typeof TRANSFER_AREAS)[number];
type HousingTransfer = {
  area: TransferArea;
  period: string;
  houseMedian: number | null;
  attachedMedian: number | null;
  houseTransfers: number | null;
  attachedTransfers: number | null;
};
type HousingCompletion = {
  state: StateCode;
  period: string;
  quarter: number | null;
  year: number | null;
};
export type QuarterlyDataset<Row> = {
  status: "available" | "unavailable";
  period: string | null;
  retrievedAt: string | null;
  sourceUrl: string;
  resourceUrl: string | null;
  observations: Row[];
};
export type HousingTransfers = QuarterlyDataset<HousingTransfer>;
export type HousingCompletions = QuarterlyDataset<HousingCompletion>;
export function quarterLabel(period: string) {
  const m = /^((?:19|20)\d{2})-Q([1-4])$/.exec(period);
  return m
    ? `${["March", "June", "September", "December"][Number(m[2]) - 1]} quarter ${m[1]}`
    : period;
}
export function quarterIndex(period: string) {
  const m = /^((?:19|20)\d{2})-Q([1-4])$/.exec(period);
  return m ? Number(m[1]) * 4 + Number(m[2]) - 1 : NaN;
}
export function housingPeriod(
  data: QuarterlyDataset<unknown> | undefined,
  asOf: string,
  requested?: string | null
) {
  if (data?.status !== "available" || !data.period || !Number.isFinite(quarterIndex(data.period)))
    return null;
  const now = new Date(asOf);
  if (!Number.isFinite(now.getTime())) return null;
  const current = now.getUTCFullYear() * 4 + Math.floor(now.getUTCMonth() / 3);
  const selected = requested ?? data.period;
  const index = quarterIndex(selected);
  if (!Number.isFinite(index) || index >= current || index > quarterIndex(data.period)) return null;
  // A current reader allows the official quarterly publication lag; explicit
  // historical links use only the requested observation in the available release.
  if (!requested && current - index > 2) return null;
  return selected;
}
export function transferArea(query: string): TransferArea | undefined {
  return TRANSFER_AREAS.find((area) => area.toLowerCase() === query.trim().toLowerCase());
}
export function transferForMarket(name: string): TransferArea | undefined {
  return transferArea(name); // Never substitute a rest-of-state aggregate for a regional city.
}
export function housingHref(kind: "transfers" | "completions", place: string, period: string) {
  return `/markets?q=${encodeURIComponent(place)}&${kind === "transfers" ? "transferPeriod" : "completionPeriod"}=${encodeURIComponent(period)}#${kind}`;
}
