const F6_CSV_URL = "https://www.rba.gov.au/statistics/tables/csv/f6-data.csv";
export const F6_SOURCE_URL = "https://www.rba.gov.au/statistics/tables/#interest-rates";

const DAY_MS = 86_400_000;
const MAX_BYTES = 256_000;
const USER_AGENT = "Mozilla/5.0 (compatible; TheDeskBot/1.0; +https://thedesk.au)";

const SERIES = {
  FLRHOFTA: {
    metricKey: "owner_occupier_new_lending_rate",
    label: "Owner-occupier new-loan rate",
    title:
      "Lending rates; Housing credit; New loans funded in the month; Owner-occupied; All loans; All institutions",
    borrower: "owner-occupier",
    displayOrder: 42,
  },
  FLRHIFTA: {
    metricKey: "investor_new_lending_rate",
    label: "Investor new-loan rate",
    title:
      "Lending rates; Housing credit; New loans funded in the month; Investment; All loans; All institutions",
    borrower: "investor",
    displayOrder: 44,
  },
} as const;

type SeriesId = keyof typeof SERIES;

export type RbaHousingRate = {
  seriesId: SeriesId;
  title: string;
  rate: number;
  period: Date;
  publicationDate: Date;
};

export type RbaHousingRateMetric = {
  metricKey: string;
  label: string;
  value: string;
  unit: "%";
  source: "RBA / APRA";
  sourceUrl: string;
  context: string;
  groupKey: "PROPERTY";
  asOf: string;
  displayOrder: number;
};

function csvRows(input: string): string[][] {
  const text = input.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index <= text.length; index++) {
    const char = index === text.length ? "\n" : text[index]!;
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("Unclosed quote in RBA F6 CSV");
  return rows;
}

function utcDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day
    ? date
    : null;
}

function parseObservationDate(value: string): Date | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/u);
  return match ? utcDate(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : null;
}

function parsePublicationDate(value: string): Date | null {
  const match = value.match(/^(\d{2})-([A-Z][a-z]{2})-(\d{4})$/u);
  if (!match) return null;
  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ].indexOf(match[2]!);
  return month < 0 ? null : utcDate(Number(match[3]), month, Number(match[1]));
}

function ageInDays(later: Date, earlier: Date): number {
  return (later.getTime() - earlier.getTime()) / DAY_MS;
}

/**
 * Parse only the two pinned all-institutions, new-loan F6 series.
 *
 * The latest table row is authoritative. A blank target cell is a gap; this
 * never walks backwards to make a missing current observation look available.
 */
export function parseRbaHousingRates(csv: string, retrievedAt: Date): RbaHousingRate[] {
  if (csv.length > MAX_BYTES || !Number.isFinite(retrievedAt.getTime())) {
    throw new Error("Invalid RBA F6 response");
  }
  const rows = csvRows(csv);
  if (rows[0]?.length !== 1 || rows[0][0] !== "F6 - HOUSING LENDING RATES") {
    throw new Error("Unexpected RBA F6 table identity");
  }

  const metadataNames = [
    "Title",
    "Description",
    "Frequency",
    "Type",
    "Units",
    "Source",
    "Publication date",
    "Series ID",
  ];
  const metadata = new Map<string, string[]>();
  for (const row of rows.slice(1)) {
    if (metadataNames.includes(row[0]!)) {
      if (metadata.has(row[0]!)) throw new Error(`Duplicate RBA F6 metadata row: ${row[0]}`);
      metadata.set(row[0]!, row);
    }
  }
  if (metadataNames.some((name) => !metadata.has(name))) {
    throw new Error("Incomplete RBA F6 metadata");
  }
  const width = metadata.get("Series ID")!.length;
  if (width < 3 || [...metadata.values()].some((row) => row.length !== width)) {
    throw new Error("Changed RBA F6 table shape");
  }

  const seriesIds = metadata.get("Series ID")!.slice(1);
  if (new Set(seriesIds).size !== seriesIds.length) throw new Error("Duplicate RBA F6 series ID");
  const columns = Object.keys(SERIES).map((seriesId) => {
    const column = seriesIds.indexOf(seriesId) + 1;
    if (column === 0) throw new Error(`Missing RBA F6 series ${seriesId}`);
    const spec = SERIES[seriesId as SeriesId];
    const expected: Record<string, string> = {
      Title: spec.title,
      Description: spec.title,
      Frequency: "Monthly",
      Type: "Original",
      Units: "Per cent per annum",
      Source: "APRA, RBA",
    };
    for (const [name, value] of Object.entries(expected)) {
      if (metadata.get(name)![column] !== value) {
        throw new Error(`Changed identity for RBA F6 series ${seriesId}: ${name}`);
      }
    }
    const publicationDate = parsePublicationDate(metadata.get("Publication date")![column]!);
    if (!publicationDate) throw new Error(`Invalid publication date for RBA F6 series ${seriesId}`);
    return { seriesId: seriesId as SeriesId, column, publicationDate };
  });
  if (new Set(columns.map(({ publicationDate }) => publicationDate.toISOString())).size !== 1) {
    throw new Error("Mismatched RBA F6 publication dates");
  }

  const observationRows = rows.slice(1).filter((row) => !metadataNames.includes(row[0]!));
  const observations = observationRows.map((row) => ({
    row,
    date: parseObservationDate(row[0] ?? ""),
  }));
  if (
    !observations.length ||
    observations.some(({ row, date }) => date === null || row.length !== width)
  ) {
    throw new Error("Invalid RBA F6 observation rows");
  }
  const validObservations = observations as Array<{ row: string[]; date: Date }>;
  const latest = validObservations.reduce((best, entry) => (entry.date > best.date ? entry : best));

  return columns.map(({ seriesId, column, publicationDate }) => {
    const raw = latest.row[column]?.trim() ?? "";
    if (!/^\d+(?:\.\d+)?$/u.test(raw)) {
      throw new Error(`Current RBA F6 observation unavailable for ${seriesId}`);
    }
    const rate = Number(raw);
    if (!Number.isFinite(rate) || rate < 0 || rate > 30) {
      throw new Error(`Implausible RBA F6 rate for ${seriesId}`);
    }
    const publicationAge = ageInDays(retrievedAt, publicationDate);
    const observationAge = ageInDays(retrievedAt, latest.date);
    if (publicationAge < -1 || publicationAge > 62 || observationAge < 0 || observationAge > 95) {
      throw new Error(`Stale or future RBA F6 observation for ${seriesId}`);
    }
    return { seriesId, title: SERIES[seriesId].title, rate, period: latest.date, publicationDate };
  });
}

function monthYear(date: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(date);
}

function displayDate(date: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function housingRateMetrics(rates: RbaHousingRate[]): RbaHousingRateMetric[] {
  return rates.map((rate) => {
    const spec = SERIES[rate.seriesId];
    return {
      metricKey: spec.metricKey,
      label: spec.label,
      value: rate.rate.toFixed(1),
      unit: "%",
      source: "RBA / APRA",
      sourceUrl: F6_SOURCE_URL,
      context: `RBA F6 ${rate.seriesId}; average on new ${spec.borrower} housing loans funded in ${monthYear(rate.period)}; all institutions; original series; published ${displayDate(rate.publicationDate)}. RBA tables may be revised.`,
      groupKey: "PROPERTY",
      asOf: rate.period.toISOString(),
      displayOrder: spec.displayOrder,
    };
  });
}

export async function fetchRbaHousingRateMetrics(): Promise<RbaHousingRateMetric[]> {
  try {
    const response = await fetch(F6_CSV_URL, {
      headers: { Accept: "text/csv", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok || Number(response.headers.get("content-length")) > MAX_BYTES) {
      throw new Error(`RBA F6 returned ${response.status}`);
    }
    const csv = await response.text();
    return housingRateMetrics(parseRbaHousingRates(csv, new Date()));
  } catch (error) {
    console.warn("[metrics] RBA F6 unavailable:", (error as Error).message);
    return [];
  }
}
