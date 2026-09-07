import {
  RENT_CITIES,
  RENT_DATA_URL,
  type CityRents,
  type RentObservation,
} from "../../shared/cityRents";
import { cached } from "../core/cache";

/** Strict CSV reader: quoted commas/newlines and doubled quotes are allowed. */
function csvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]!;
    if (quoted) {
      if (char === '"') {
        if (csv[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += char;
    } else if (char === "," || char === "\n" || char === "\r") {
      row.push(value);
      value = "";
      closed = false;
      if (char !== ",") {
        if (row.some((cell) => cell !== "")) rows.push(row);
        row = [];
        if (char === "\r" && csv[i + 1] === "\n") i++;
      }
    } else if (char === '"' && !value && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new Error("Malformed ABS CSV");
      value += char;
    }
  }
  if (quoted) throw new Error("Unclosed ABS CSV field");
  row.push(value);
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

/** Pin the full series identity. Missing values must never become numeric zero. */
export function parseAbsRents(csv: string, retrievedAt: string): CityRents {
  if (csv.length > 64_000 || !Number.isFinite(Date.parse(retrievedAt)))
    throw new Error("Invalid ABS response");
  const [header, ...rows] = csvRows(csv.replace(/^\uFEFF/, ""));
  const required = [
    "DATAFLOW",
    "MEASURE",
    "INDEX",
    "TSEST",
    "REGION",
    "FREQ",
    "TIME_PERIOD",
    "OBS_VALUE",
    "UNIT_MEASURE",
    "OBS_STATUS",
  ];
  if (
    !header ||
    new Set(header).size !== header.length ||
    required.some((key) => !header.includes(key)) ||
    rows.length > 16
  )
    throw new Error("Unexpected ABS schema");
  const observations: RentObservation[] = [];
  const seen = new Set<string>();
  for (const cells of rows) {
    if (cells.length !== header.length) throw new Error("Unexpected ABS row");
    const row = Object.fromEntries(header.map((key, index) => [key, cells[index]!]));
    if (
      row.DATAFLOW !== "ABS:CPI(2.0.0)" ||
      row.MEASURE !== "3" ||
      row.INDEX !== "30014" ||
      row.TSEST !== "10" ||
      row.FREQ !== "M" ||
      row.UNIT_MEASURE !== "PCT" ||
      !/^[1-8]$/.test(row.REGION!)
    )
      throw new Error("Unexpected ABS series");
    const period = row.TIME_PERIOD!;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period) || period >= retrievedAt.slice(0, 7))
      throw new Error("Invalid ABS observation period");
    const city = RENT_CITIES[Number(row.REGION) - 1]!;
    const key = `${city}:${period}`;
    if (seen.has(key)) throw new Error("Duplicate ABS observation");
    seen.add(key);
    // Suppressed, missing, break-in-series and uncertain estimates are withheld.
    if (!["", "p", "r"].includes(row.OBS_STATUS!)) continue;
    if (!/^-?\d+(?:\.\d+)?$/.test(row.OBS_VALUE!)) continue;
    const annualPercent = Number(row.OBS_VALUE);
    if (!Number.isFinite(annualPercent) || annualPercent < -100) continue;
    observations.push({
      city,
      period,
      annualPercent,
      status: row.OBS_STATUS as RentObservation["status"],
    });
  }
  // Do not silently use an older observation when the newest one is suppressed.
  const latestPeriods = new Map<string, string>();
  for (const key of seen) {
    const [city, period] = key.split(":") as [string, string];
    if (period > (latestPeriods.get(city) ?? "")) latestPeriods.set(city, period);
  }
  const valid = observations.filter((row) =>
    observations.some(
      (other) => other.city === row.city && other.period === latestPeriods.get(row.city)
    )
  );
  return { status: valid.length ? "available" : "unavailable", retrievedAt, observations: valid };
}

export async function getCityRents(): Promise<CityRents> {
  // Short negative cache prevents outage retry storms; successful reads last an hour.
  return cached("abs:rents:attempt", 60_000, async () => {
    try {
      return await cached("abs:rents:data", 3_600_000, async () => {
        const response = await fetch(RENT_DATA_URL, {
          headers: { Accept: "text/csv" },
          signal: AbortSignal.timeout(15_000),
        });
        if (
          !response.ok ||
          !["text/csv", "application/vnd.sdmx.data+csv"].includes(
            (response.headers.get("content-type") ?? "").split(";")[0]!.trim()
          ) ||
          Number(response.headers.get("content-length")) > 64_000
        )
          throw new Error("ABS rents unavailable");
        // Bound streamed bodies too; Content-Length is optional.
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Empty ABS response");
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 64_000) throw new Error("Oversized ABS response");
            chunks.push(value);
          }
        } finally {
          await reader.cancel();
        }
        const result = parseAbsRents(
          Buffer.concat(chunks).toString("utf8"),
          new Date().toISOString()
        );
        if (result.status !== "available") throw new Error("No usable ABS observations");
        return result;
      });
    } catch {
      return { status: "unavailable", retrievedAt: null, observations: [] };
    }
  });
}
