import { csvRows } from "../../../server/core/strictCsv";

export const CASH_RATE_CSV = "https://www.rba.gov.au/statistics/tables/csv/f1-data.csv";
const MAX_BYTES = 1_000_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** F1's daily target, pinned by series ID; F1.1 is the monthly table. */
export function parseCashRate(csv: string, now = new Date()) {
  if (csv.length > MAX_BYTES || !Number.isFinite(now.getTime()))
    throw new Error("Invalid RBA F1 response");
  const rows = csvRows(csv.replace(/^\uFEFF/, ""));
  const ids = rows.filter((row) => row[0] === "Series ID");
  if (ids.length !== 1 || ids[0]!.filter((cell) => cell === "FIRMMCRTD").length !== 1)
    throw new Error("Missing or duplicate RBA daily cash target series");
  const column = ids[0]!.indexOf("FIRMMCRTD");
  for (const [key, value] of Object.entries({
    Title: "Cash Rate Target",
    Frequency: "Daily",
    Type: "Original",
    Units: "Per cent",
    Source: "RBA",
  })) {
    const metadata = rows.filter((row) => row[0] === key);
    if (metadata.length !== 1 || metadata[0]![column] !== value)
      throw new Error(`Unexpected RBA daily cash target ${key}`);
  }
  const observations = rows
    .flatMap((row) => {
      const match = row[0]?.match(/^(\d{1,2})-([A-Z][a-z]{2})-(\d{4})$/);
      if (!match) return [];
      const month = MONTHS.indexOf(match[2]!);
      const asOf = new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
      if (month < 0 || asOf.getUTCMonth() !== month || asOf.getUTCDate() !== Number(match[1]))
        throw new Error("Invalid RBA cash target date");
      return [{ asOf, raw: row[column]?.trim() ?? "" }];
    })
    .sort((a, b) => b.asOf.getTime() - a.asOf.getTime());
  const today = now.toISOString().slice(0, 10);
  // RBA may include today's unfinished row. Never skip an older missing observation.
  const latest = observations.find(
    (row) => !(row.asOf.toISOString().slice(0, 10) === today && row.raw === "")
  );
  if (!latest || !/^\d+(?:\.\d+)?$/.test(latest.raw))
    throw new Error("RBA daily cash target unavailable");
  const rate = Number(latest.raw);
  const age = (now.getTime() - latest.asOf.getTime()) / 86_400_000;
  if (!Number.isFinite(rate) || rate < 0 || rate > 30 || age < 0 || age > 7)
    throw new Error("Stale, future or invalid RBA daily cash target");
  return { rate, asOf: latest.asOf };
}

export async function fetchCashRate() {
  try {
    const response = await fetch(CASH_RATE_CSV, {
      headers: { Accept: "text/csv" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok || Number(response.headers.get("content-length")) > MAX_BYTES)
      throw new Error(`RBA F1 HTTP ${response.status}`);
    return parseCashRate(await response.text());
  } catch (error) {
    console.warn("[metrics] RBA daily cash target unavailable:", (error as Error).message);
    return null;
  }
}
