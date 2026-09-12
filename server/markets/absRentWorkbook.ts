import {
  RENT_CITIES,
  RENT_SOURCE,
  type CityRents,
  type RentObservation,
} from "../../shared/cityRents";
import { cached } from "../core/cache";
import { sourceLinks } from "../localData/fetch";
import type { Sheet } from "../localData/parsers";
import { readWorkbook } from "../localData/workbook";

// Table 11 publishes both the rent sub-group and expenditure class. Pin both
// reviewed series and require agreement, rather than selecting a duplicate label.
const RENT_WORKBOOK_SERIES = [
  ["A130392587K", "A130390459F"],
  ["A130397628K", "A130390466C"],
  ["A130398800V", "A130399255T"],
  ["A130398807K", "A130399262R"],
  ["A130392594J", "A130395527L"],
  ["A130396276X", "A130394386A"],
  ["A130392601V", "A130397978K"],
  ["A130395219K", "A130394393X"],
] as const;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const PATH =
  /^\/statistics\/economy\/price-indexes-and-inflation\/consumer-price-index-australia\/([a-z]{3})-(\d{4})\/6401011\.xlsx$/;

export function rentWorkbookPeriod(url: string): string {
  const parsed = new URL(url);
  const match = parsed.pathname.match(PATH);
  if (
    parsed.origin !== "https://www.abs.gov.au" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !match
  )
    throw new Error("Unexpected ABS rent workbook URL");
  const month = MONTHS.indexOf(match[1]!);
  if (month < 0) throw new Error("Invalid rent release month");
  return `${match[2]}-${String(month + 1).padStart(2, "0")}`;
}

export function discoverRentWorkbook(html: string, now: string): string {
  const urls = sourceLinks(html, RENT_SOURCE).filter((url) => {
    try {
      rentWorkbookPeriod(url);
      return true;
    } catch {
      return false;
    }
  });
  // A changed/ambiguous publication layout needs review, not a guessed month.
  if (urls.length !== 1 || rentWorkbookPeriod(urls[0]!) >= now.slice(0, 7))
    throw new Error("No unambiguous completed ABS rent release");
  return urls[0]!;
}

function month(value: unknown): string | null {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime()) || value.getUTCDate() !== 1)
    return null;
  return value.toISOString().slice(0, 7);
}

export function parseRentWorkbook(
  sheets: Sheet[],
  sourceUrl: string,
  retrievedAt: string
): CityRents {
  const period = rentWorkbookPeriod(sourceUrl);
  if (!Number.isFinite(Date.parse(retrievedAt)) || period >= retrievedAt.slice(0, 7))
    throw new Error("Invalid rent observation date");
  const columns = new Map<string, { sheet: Sheet; column: number }>();
  const expected = new Set<string>(RENT_WORKBOOK_SERIES.flat());
  for (const sheet of sheets) {
    if (!/^Data\d+$/.test(sheet.sheet)) continue;
    sheet.data[9]?.forEach((id, column) => {
      if (typeof id !== "string" || !expected.has(id)) return;
      if (columns.has(id)) throw new Error("Duplicate rent series ID");
      columns.set(id, { sheet, column });
    });
  }
  if (columns.size !== expected.size) throw new Error("Missing pinned rent series");
  const observations: RentObservation[] = [];
  RENT_CITIES.forEach((city, index) => {
    const pairs = RENT_WORKBOOK_SERIES[index]!.map((id) => {
      const { sheet, column } = columns.get(id)!;
      const label = String(sheet.data[0]?.[column]).replace(/\s+/g, " ").trim();
      if (
        label !==
          `Percentage Change from Corresponding Month of Previous Year ; Rents ; ${city} ;` ||
        sheet.data[1]?.[column] !== "Percent" ||
        sheet.data[2]?.[column] !== "Original" ||
        sheet.data[4]?.[column] !== "Month" ||
        month(sheet.data[7]?.[column]) !== period
      )
        throw new Error("Rent workbook identity changed");
      const values = new Map<string, number | null>();
      for (const row of sheet.data.slice(10)) {
        const date = month(row[0]);
        if (!date) continue;
        if (date > period || values.has(date)) throw new Error("Unexpected rent workbook dates");
        const value = row[column];
        values.set(
          date,
          typeof value === "number" && Number.isFinite(value) && value >= -100 ? value : null
        );
      }
      return values;
    });
    const current = pairs[0]!.get(period);
    // Missing, footnoted or divergent current values withhold the whole city.
    if (current == null || pairs[1]!.get(period) !== current) return;
    for (const date of [...pairs[0]!.keys()].sort().slice(-2)) {
      const value = pairs[0]!.get(date);
      if (value != null && pairs[1]!.get(date) === value)
        observations.push({ city, period: date, annualPercent: value, status: "" });
    }
  });
  return {
    status: observations.length ? "available" : "unavailable",
    retrievedAt,
    observations,
    sourceUrl,
    delivery: "workbook",
  };
}

async function download(url: string, limit: number, signal: AbortSignal) {
  // Fixed publisher and exact reviewed path. Reject redirects rather than
  // following a publisher-controlled URL to an unreviewed host.
  if (url !== RENT_SOURCE) rentWorkbookPeriod(url);
  const response = await fetch(url, { redirect: "error", signal });
  if (response.status !== 200 || Number(response.headers.get("content-length")) > limit) {
    await response.body?.cancel();
    throw new Error("ABS release download unavailable");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing ABS release body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new Error("ABS release too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}

export async function getPublishedCityRents(): Promise<CityRents> {
  const signal = AbortSignal.timeout(8_000);
  const retrievedAt = new Date().toISOString();
  const html = (await download(RENT_SOURCE, 2_000_000, signal)).toString("utf8");
  const url = discoverRentWorkbook(html, retrievedAt);
  // Discover first; a new release gets a new key. Do not repeatedly download
  // or parse an unchanged release during an API outage.
  return cached(`abs:rents:workbook:${url}`, 6 * 3_600_000, async () => {
    const bytes = await download(url, 1_000_000, signal);
    const data = parseRentWorkbook(await readWorkbook(bytes, signal, "abs-cpi"), url, retrievedAt);
    if (data.status !== "available") throw new Error("No usable published rents");
    return data;
  });
}
