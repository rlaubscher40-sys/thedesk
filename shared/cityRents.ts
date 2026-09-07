/** ABS CPI capital-city boundaries; never substitute a capital for a regional market. */
export const RENT_CITIES = [
  "Sydney",
  "Melbourne",
  "Brisbane",
  "Adelaide",
  "Perth",
  "Hobart",
  "Darwin",
  "Canberra",
] as const;
export const RENT_SOURCE =
  "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release";
export const RENT_DATA_URL =
  "https://data.api.abs.gov.au/rest/data/ABS,CPI,2.0.0/3.30014.10.1+2+3+4+5+6+7+8.M?lastNObservations=2&format=csv";
export type RentObservation = {
  city: string;
  period: string;
  annualPercent: number;
  status: "" | "p" | "r";
};
export type CityRents = {
  status: "available" | "unavailable";
  retrievedAt: string | null;
  observations: RentObservation[];
};
export function rentCity(name: string): string | undefined {
  return RENT_CITIES.find((city) => city.toLowerCase() === name.trim().toLowerCase());
}
export function latestRent(data: CityRents | undefined, name: string): RentObservation | undefined {
  const city = rentCity(name);
  if (!city || data?.status !== "available") return undefined;
  return data.observations
    .filter((row) => row.city === city)
    .sort((a, b) => b.period.localeCompare(a.period))[0];
}
export function rentIsOlder(row: RentObservation, asOf: string): boolean {
  // More than three calendar months behind the read date is explicitly labelled older.
  const months = (value: string) => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7));
  return months(asOf) - months(row.period) > 3;
}
export function rentGap(
  a: RentObservation | undefined,
  b: RentObservation | undefined,
  asOf: string
): number | null {
  if (
    !a ||
    !b ||
    a.city === b.city ||
    a.period !== b.period ||
    rentIsOlder(a, asOf) ||
    rentIsOlder(b, asOf)
  )
    return null;
  return Math.round((a.annualPercent - b.annualPercent) * 10) / 10;
}
export function rentPeriod(period: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${period}-01T00:00:00Z`));
}
