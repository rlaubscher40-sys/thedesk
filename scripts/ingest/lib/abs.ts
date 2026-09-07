/**
 * ABS metrics, by API where we can and by scraping where we must.
 *
 * This file used to be scraping only, on the reasoning that the release pages
 * "have stayed structurally consistent for years". That was a workaround, not a
 * decision: the ABS publishes the same figures through a free, keyless official
 * API, and this repo already prefers that shape elsewhere (the RBA cash rate is
 * a CSV endpoint, not a scrape). The API gives a stable contract, every
 * dimension in one request, machine-readable periods, and — the one that
 * changes the product — decades of history rather than only the latest value.
 *
 * So each metric now carries two ways of getting its number:
 *
 *   api    optional. `scripts/ingest/lib/absApi.ts`, preferred when present.
 *   scrape the existing regex path, kept as the fallback.
 *
 * ## Nobody pastes an identifier in
 *
 * A dataflow identifier cannot be written from memory, and requiring a human to
 * look one up is a manual step on a pipeline that is supposed to run itself. So
 * no identifier is hardcoded: each metric declares what to search for and what
 * range its value must fall in, and `absDiscover.ts` finds the flow at run time
 * and proves it before using it.
 *
 * The range is what makes that safe. A flow that matches a name well and
 * returns perfectly good numbers for the WRONG series would publish
 * right-looking wrong figures, which is worse than having no metric at all.
 * "Unemployment is between 2 and 15 per cent" is known independently of the
 * API, so a 137 is caught as an index level and the metric scrapes instead.
 *
 * `pnpm probe:abs` still exists for looking at a flow by hand, and pinning a
 * `flowRef` explicitly still overrides discovery. Neither is required.
 *
 * Each fetched value is paired with its `asOf` timestamp. From the API that is
 * the observation's own period; a scrape requires a readable reference period.
 * Missing or invalid periods never fall back to the run timestamp.
 */

import { absDataflowUrl, fetchAbsSeries, latestObservation } from "./absApi";
import { resolveFlow, type Dataflow, type DiscoverSpec } from "./absDiscover";

const UA = "Mozilla/5.0 (compatible; TheDeskBot/1.0; +https://thedesk.au)";

export type AbsResult = {
  metricKey: string;
  label: string;
  value: string;
  unit: string;
  context: string | null;
  groupKey: string;
  source: string;
  asOf: Date;
  displayOrder: number;
} | null;

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(`[abs] ${url} → ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`[abs] ${url} error: ${(err as Error).message}`);
    return null;
  }
}

/** Best-effort: pull the "Reference period" date from the page header. */
export function findReferenceDate(html: string): Date | null {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const m = text.match(/Reference period\s+([A-Za-z]+)\s+(\d{4})\b/i);
  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  if (!m) return null;
  const month = months.indexOf(m[1]!.toLowerCase());
  return month === -1 ? null : new Date(Date.UTC(Number(m[2]), month, 1));
}

/**
 * Generic helper. Fetch the page; run each pattern in order until one
 * matches; coerce to a number; return the row.
 */
async function scrapeAbs(args: {
  url: string;
  metricKey: string;
  label: string;
  unit: string;
  context: string | null;
  groupKey: string;
  displayOrder: number;
  patterns: RegExp[];
}): Promise<AbsResult> {
  const html = await fetchHtml(args.url);
  if (!html) return null;
  const asOf = findReferenceDate(html);
  if (!asOf) {
    console.warn(`[abs] no reference period for ${args.metricKey}`);
    return null;
  }
  for (const re of args.patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      const raw = m[1].replace(/[,\s]/g, "");
      const num = Number(raw);
      if (Number.isFinite(num)) {
        return {
          metricKey: args.metricKey,
          label: args.label,
          value: m[1].trim(),
          unit: args.unit,
          context: args.context,
          groupKey: args.groupKey,
          source: "ABS",
          asOf,
          displayOrder: args.displayOrder,
        };
      }
    }
  }
  console.warn(`[abs] no pattern matched for ${args.metricKey}`);
  return null;
}

/**
 * How to get a metric from the API, once its flow is known.
 *
 * `dimensionFilter` narrows a flow that publishes many series down to the one
 * wanted — most flows carry every state, every measure and every adjustment
 * type, so "the latest observation" is meaningless without it.
 */
export type AbsApiSpec = {
  /**
   * e.g. "ABS,BUILDING_APPROVALS,1.0.0". Optional: when absent, `discover`
   * finds it from the catalogue at run time so nobody has to paste one in.
   */
  flowRef?: string;
  /** How to find the flow when no `flowRef` is pinned. */
  discover?: DiscoverSpec;
  /** Dot-separated dimension key, or omitted for the whole flow. */
  dataKey?: string;
  /** Keep only observations whose dimensions match all of these. */
  dimensionFilter?: Record<string, string>;
  startPeriod?: string;
  /** Formats the observation for display. Defaults to the raw number. */
  format?: (value: number) => string;
};

type ScrapeSpec = {
  url: string;
  metricKey: string;
  label: string;
  unit: string;
  context: string | null;
  groupKey: string;
  displayOrder: number;
  patterns: RegExp[];
};

/** Reject unfamiliar periods rather than dating old data as today's observation. */
export function periodToDate(period: string): Date | null {
  const quarter = period.match(/^(\d{4})-Q([1-4])$/);
  if (quarter) return new Date(Date.UTC(Number(quarter[1]), Number(quarter[2]) * 3 - 1, 1));
  const month = period.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (month) return new Date(Date.UTC(Number(month[1]), Number(month[2]) - 1, 1));
  const year = period.match(/^(\d{4})$/);
  if (year) return new Date(Date.UTC(Number(year[1]), 11, 31));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) return null;
  const d = new Date(`${period}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === period ? d : null;
}

/**
 * The dataflow catalogue, fetched once per process.
 *
 * Five metrics resolving independently would otherwise pull the same catalogue
 * five times per run. Cached as the promise rather than the result so
 * concurrent callers share one request instead of racing.
 */
let cataloguePromise: Promise<Dataflow[]> | null = null;

function collectDataflows(node: unknown, out: Dataflow[] = []): Dataflow[] {
  if (Array.isArray(node)) {
    for (const child of node) collectDataflows(child, out);
    return out;
  }
  if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (typeof o.id === "string" && (typeof o.name === "string" || typeof o.names === "object")) {
      const name =
        typeof o.name === "string"
          ? o.name
          : ((o.names as Record<string, string> | undefined)?.en ?? "");
      if (name) {
        out.push({
          id: o.id,
          agency: typeof o.agencyID === "string" ? o.agencyID : "ABS",
          version: typeof o.version === "string" ? o.version : "1.0.0",
          name,
        });
      }
    }
    for (const child of Object.values(o)) collectDataflows(child, out);
  }
  return out;
}

async function loadCatalogue(): Promise<Dataflow[]> {
  cataloguePromise ??= (async () => {
    try {
      const res = await fetch(absDataflowUrl(), {
        headers: { "User-Agent": UA, Accept: "application/json" },
      });
      if (!res.ok) {
        console.warn(`[abs] catalogue unavailable (${res.status}); metrics will scrape.`);
        return [];
      }
      const flows = collectDataflows(await res.json());
      console.log(`[abs] catalogue: ${flows.length} dataflows`);
      return flows;
    } catch (err) {
      console.warn(
        `[abs] catalogue fetch failed (${(err as Error).message}); metrics will scrape.`
      );
      return [];
    }
  })();
  return cataloguePromise;
}

/** Resolved flow references, so a second run in the same process does not
 *  re-search for something it already found. */
const resolved = new Map<string, string>();

/**
 * Fetch one metric, preferring the API and falling back to the scrape.
 *
 * The fallback is what makes switching a metric over safe: a flow reference
 * that turns out to be wrong costs a log line, not the metric. It is
 * deliberately loud about taking the fallback, because a silent fallback is how
 * you end up believing you migrated something a year after it quietly reverted.
 */
export async function fetchAbsMetric(spec: {
  api?: AbsApiSpec;
  scrape: ScrapeSpec;
}): Promise<AbsResult> {
  if (spec.api) {
    const key = spec.scrape.metricKey;
    let flowRef = spec.api.flowRef ?? resolved.get(key) ?? null;

    // No pinned reference: search the catalogue and prove the candidate before
    // trusting it. A wrong-but-valid flow would publish right-looking wrong
    // numbers, so resolveFlow only accepts one whose latest value is plausible.
    if (!flowRef && spec.api.discover) {
      const catalogue = await loadCatalogue();
      if (catalogue.length > 0) {
        const found = await resolveFlow(catalogue, spec.api.discover);
        if (found) {
          flowRef = found.flowRef;
          resolved.set(key, found.flowRef);
        } else {
          console.warn(`[abs] ${key}: no dataflow matched and passed its range check; scraping.`);
        }
      }
    }

    if (!flowRef) return scrapeAbs(spec.scrape);

    const result = await fetchAbsSeries({
      flowRef,
      dataKey: spec.api.dataKey,
      startPeriod: spec.api.startPeriod,
    });
    if (result.ok) {
      const filter = spec.api.dimensionFilter;
      const matching = filter
        ? result.observations.filter((o) =>
            Object.entries(filter).every(([k, v]) => o.dimensions[k] === v)
          )
        : result.observations;
      const latest = latestObservation(matching);
      const asOf = latest ? periodToDate(latest.period) : null;
      if (latest && asOf) {
        return {
          metricKey: spec.scrape.metricKey,
          label: spec.scrape.label,
          value: spec.api.format ? spec.api.format(latest.value) : String(latest.value),
          unit: spec.scrape.unit,
          context: spec.scrape.context,
          groupKey: spec.scrape.groupKey,
          source: "ABS",
          asOf,
          displayOrder: spec.scrape.displayOrder,
        };
      }
      console.warn(
        `[abs] ${spec.scrape.metricKey}: API returned data but nothing matched the filter; falling back to the scrape.`
      );
    } else {
      console.warn(
        `[abs] ${spec.scrape.metricKey}: API path failed (${result.error}); falling back to the scrape.`
      );
    }
  }
  return scrapeAbs(spec.scrape);
}

export async function fetchCpiTrimmedMean(): Promise<AbsResult> {
  return fetchAbsMetric({
    api: {
      discover: {
        terms: ["consumer price index", "cpi"],
        exclude: ["capital cities", "international"],
        // Annual trimmed mean CPI. Australia has not seen sustained deflation
        // or double-digit inflation in decades; outside this it is an index
        // level, not a rate.
        expectRange: [-2, 20],
      },
    },
    scrape: {
      url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release",
      metricKey: "cpi_trimmed",
      label: "Trimmed mean CPI",
      unit: "%",
      context: "ABS · annual change",
      groupKey: "MACRO",
      displayOrder: 20,
      patterns: [
        /[Tt]rimmed mean[^0-9%]{0,200}?([0-9]+(?:\.[0-9]+)?)\s*%/,
        /Annual trimmed mean[^0-9]{0,200}?([0-9]+(?:\.[0-9]+)?)/,
      ],
    },
  });
}

export async function fetchUnemploymentRate(): Promise<AbsResult> {
  return fetchAbsMetric({
    api: {
      discover: {
        terms: ["labour force", "unemployment"],
        exclude: ["detailed", "regional"],
        // A national unemployment rate. A reading of 137 is an index, not a
        // rate, and that is exactly the mistake this catches.
        expectRange: [2, 15],
      },
    },
    scrape: {
      url: "https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/latest-release",
      metricKey: "unemployment",
      label: "Unemployment rate",
      unit: "%",
      context: "ABS seasonally adjusted",
      groupKey: "LABOUR",
      displayOrder: 70,
      patterns: [
        /[Uu]nemployment rate[^0-9%]{0,200}?([0-9]+(?:\.[0-9]+)?)\s*%/,
        /[Uu]nemployment[^0-9%]{0,80}?([0-9]+\.[0-9])\s*per cent/,
      ],
    },
  });
}

export async function fetchWageGrowth(): Promise<AbsResult> {
  return fetchAbsMetric({
    api: {
      discover: {
        terms: ["wage price index", "wage"],
        exclude: ["industry", "detailed"],
        // Annual WPI growth.
        expectRange: [-2, 15],
      },
    },
    scrape: {
      url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/wage-price-index-australia/latest-release",
      metricKey: "wage_growth",
      label: "Wage growth (WPI)",
      unit: "%",
      context: "ABS quarterly",
      groupKey: "LABOUR",
      displayOrder: 80,
      patterns: [
        /[Ww]age [Pp]rice [Ii]ndex[^0-9%]{0,300}?([0-9]+(?:\.[0-9]+)?)\s*%/,
        /[Aa]nnual[^0-9%]{0,200}?([0-9]+(?:\.[0-9]+)?)\s*%/,
      ],
    },
  });
}

export async function fetchBuildingApprovals(): Promise<AbsResult> {
  return fetchAbsMetric({
    api: {
      discover: {
        terms: ["building approvals", "dwelling"],
        exclude: ["value", "alterations"],
        // Total dwelling units approved in a month, nationally. Thousands, not
        // a rate and not a dollar value.
        expectRange: [3_000, 40_000],
      },
    },
    scrape: {
      url: "https://www.abs.gov.au/statistics/industry/building-and-construction/building-approvals-australia/latest-release",
      metricKey: "building_approvals",
      label: "Building approvals",
      unit: "",
      context: "ABS monthly · total dwellings",
      groupKey: "PROPERTY",
      displayOrder: 60,
      patterns: [
        /[Tt]otal dwellings[^0-9]{0,200}?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})/,
        /[Dd]welling units approved[^0-9]{0,200}?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})/,
      ],
    },
  });
}

export async function fetchNetMigration(): Promise<AbsResult> {
  return fetchAbsMetric({
    api: {
      discover: {
        terms: ["net overseas migration", "migration", "population"],
        exclude: ["interstate", "regional"],
        // Annual net overseas migration. Tens to hundreds of thousands.
        expectRange: [-100_000, 800_000],
      },
    },
    scrape: {
      url: "https://www.abs.gov.au/statistics/people/population/national-state-and-territory-population/latest-release",
      metricKey: "net_migration",
      label: "Net migration",
      unit: "",
      context: "ABS quarterly · NOM",
      groupKey: "DEMOGRAPHICS",
      displayOrder: 120,
      patterns: [
        /[Nn]et overseas migration[^0-9]{0,300}?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{5,})/,
        /[Nn]et migration[^0-9]{0,200}?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{5,})/,
      ],
    },
  });
}

export async function fetchAllAbs(): Promise<AbsResult[]> {
  return Promise.all([
    fetchCpiTrimmedMean(),
    fetchUnemploymentRate(),
    fetchWageGrowth(),
    fetchBuildingApprovals(),
    fetchNetMigration(),
  ]);
}
