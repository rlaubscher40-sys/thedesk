/**
 * The ABS Data API — free, keyless, and the right way to get this data.
 *
 * `abs.ts` scrapes ABS release pages with regexes. That was always a
 * workaround: the ABS publishes the same figures through an official API at
 * `data.api.abs.gov.au` with no key, no registration and no cost, and the repo
 * already uses exactly this pattern for the RBA (`f1.1-data.csv`). ABS was the
 * outlier.
 *
 * Four things the API gives us that scraping cannot:
 *
 *   1. A stable contract. Dataflow identifiers do not change; page markup does,
 *      which is why abs.ts is written to expect its own patterns to fail.
 *   2. Every dimension in one request. Per-state figures come back as rows
 *      rather than needing a label-hunt through a flattened table.
 *   3. The whole time series, not just the latest value. This is the one that
 *      changes the product: `monthlyReview` currently ranks a month against the
 *      history we have happened to accumulate, and this lets it rank against
 *      decades. "The biggest monthly fall since 2011" is a claim we cannot make
 *      today and could make immediately.
 *   4. Machine-readable periods, replacing a regex that guesses at a date.
 *
 * ## Why SDMX-CSV and not SDMX-JSON
 *
 * The API speaks both. The JSON is a normalised structure that needs the
 * dimensions reassembled from separate index arrays; the CSV is already a flat
 * table with one row per observation. For reading a series there is no reason
 * to take on the JSON, and a dependency-free CSV parse is easier to reason
 * about than a nested lookup.
 *
 * ## Dataflow identifiers are deliberately absent
 *
 * No flow references are hardcoded here. This environment cannot reach ABS, so
 * any identifier written from memory would be a guess wearing the costume of a
 * fact, and a wrong identifier fails exactly like a wrong regex. Run
 * `pnpm probe:abs` to list the real ones, then put them in the ingest config.
 */

export const ABS_API_BASE = "https://data.api.abs.gov.au/rest";

const UA = "Mozilla/5.0 (compatible; TheDeskBot/1.0; +https://thedesk.au)";

export type AbsObservation = {
  /** Every dimension column the flow returned, keyed by column name. */
  dimensions: Record<string, string>;
  /** "2024", "2024-Q1", "2024-06" — whatever granularity the flow publishes. */
  period: string;
  value: number;
};

/**
 * Minimal RFC 4180 CSV split for one line.
 *
 * Written rather than pulled in because SDMX-CSV quotes fields containing
 * commas — dimension labels routinely do ("Australian Capital Territory, ACT")
 * — and a naive `split(",")` silently shifts every column after the first
 * quoted one, which corrupts values without erroring.
 */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inQuotes) {
      if (c === '"') {
        // A doubled quote inside a quoted field is one literal quote.
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      out.push(field);
      field = "";
    } else field += c;
  }
  out.push(field);
  return out;
}

/**
 * Parse an SDMX-CSV response into observations.
 *
 * Column names are read from the header rather than assumed, because every
 * dataflow has its own dimensions. Only TIME_PERIOD and OBS_VALUE are required,
 * and they are the two the format guarantees.
 *
 * A row whose value is not a number is dropped, not zeroed: ABS marks
 * unavailable observations with flags rather than figures, and turning "not
 * published" into 0 would put a fabricated number into a series whose whole
 * value is that its numbers are real.
 */
export function parseSdmxCsv(csv: string): AbsObservation[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]!).map((h) => h.trim());
  const timeIdx = header.findIndex((h) => h.toUpperCase() === "TIME_PERIOD");
  const valueIdx = header.findIndex((h) => h.toUpperCase() === "OBS_VALUE");
  if (timeIdx === -1 || valueIdx === -1) return [];

  const out: AbsObservation[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const rawValue = cells[valueIdx]?.trim() ?? "";
    const period = cells[timeIdx]?.trim() ?? "";
    if (!period || rawValue === "") continue;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) continue;

    const dimensions: Record<string, string> = {};
    header.forEach((name, i) => {
      if (i === timeIdx || i === valueIdx) return;
      const cell = cells[i]?.trim();
      if (cell) dimensions[name] = cell;
    });
    out.push({ dimensions, period, value });
  }
  return out;
}

/** Observations sorted oldest first. ABS does not guarantee an order, and the
 *  caller almost always wants a series it can walk. */
export function sortByPeriod(rows: AbsObservation[]): AbsObservation[] {
  return [...rows].sort((a, b) => a.period.localeCompare(b.period));
}

/** The most recent observation, or null when the series came back empty. */
export function latestObservation(rows: AbsObservation[]): AbsObservation | null {
  const sorted = sortByPeriod(rows);
  return sorted[sorted.length - 1] ?? null;
}

/**
 * Build a data URL.
 *
 * `dataKey` is the dot-separated dimension filter the flow defines; "all"
 * fetches every series in it, which is what the probe wants and what a
 * per-state series needs.
 */
export function absDataUrl(args: {
  flowRef: string;
  dataKey?: string;
  startPeriod?: string;
}): string {
  const key = args.dataKey?.trim() || "all";
  const params = new URLSearchParams({ format: "csv" });
  if (args.startPeriod) params.set("startPeriod", args.startPeriod);
  return `${ABS_API_BASE}/data/${encodeURIComponent(args.flowRef)}/${encodeURIComponent(key)}?${params}`;
}

/** URL for the dataflow catalogue — how you find out what exists. */
export function absDataflowUrl(): string {
  return `${ABS_API_BASE}/dataflow/ABS?format=jsondata`;
}

export type AbsFetchResult =
  | { ok: true; observations: AbsObservation[] }
  | { ok: false; error: string };

/**
 * Fetch one series. Never throws: the caller is a scheduled ingest, and a
 * source being down should degrade one metric rather than the run.
 */
export async function fetchAbsSeries(args: {
  flowRef: string;
  dataKey?: string;
  startPeriod?: string;
}): Promise<AbsFetchResult> {
  const url = absDataUrl(args);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/csv" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, error: `${res.status} ${res.statusText}` };
    const csv = await res.text();
    const observations = parseSdmxCsv(csv);
    if (observations.length === 0) {
      return { ok: false, error: "response parsed to zero observations" };
    }
    return { ok: true, observations };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
