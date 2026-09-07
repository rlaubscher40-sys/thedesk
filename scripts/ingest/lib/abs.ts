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
 * ## Why every `api` block below is still empty
 *
 * A dataflow identifier cannot be written from memory. A wrong one fails
 * exactly like a wrong regex, and the environment this was built in cannot
 * reach ABS to check. So the plumbing is here and tested, and the identifiers
 * are the one thing that needs a network round-trip:
 *
 *   pnpm probe:abs migration          find the flow
 *   pnpm probe:abs --flow "ABS,..."   confirm its dimensions and history
 *
 * Paste the result into the `api` block for that metric and it switches over.
 * Until then every metric runs exactly as it does today, so nothing that
 * currently works can break on the way.
 *
 * Each fetched value is paired with its `asOf` timestamp. From the API that is
 * the observation's own period; from a scrape it is a best-effort read of the
 * page's released date, falling back to the run timestamp.
 */

import { fetchAbsSeries, latestObservation } from "./absApi";

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
function findReferenceDate(html: string): Date {
  const m =
    html.match(/Reference period[^<]*<[^>]*>\s*([A-Za-z]+ \d{4})/i) ||
    html.match(/Released[^<]*<[^>]*>\s*(\d{1,2} [A-Za-z]+ \d{4})/i);
  if (m && m[1]) {
    const d = new Date(m[1]);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
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
          asOf: findReferenceDate(html),
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
  /** e.g. "ABS,BUILDING_APPROVALS,1.0.0". From `pnpm probe:abs`. */
  flowRef: string;
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

/** Turn an SDMX period ("2026-Q1", "2026-06", "2026") into a date. Best effort:
 *  a period we cannot read is not worth failing the metric over. */
function periodToDate(period: string): Date {
  const quarter = period.match(/^(\d{4})-Q([1-4])$/);
  if (quarter) return new Date(Date.UTC(Number(quarter[1]), Number(quarter[2]) * 3 - 1, 1));
  const month = period.match(/^(\d{4})-(\d{2})$/);
  if (month) return new Date(Date.UTC(Number(month[1]), Number(month[2]) - 1, 1));
  const year = period.match(/^(\d{4})$/);
  if (year) return new Date(Date.UTC(Number(year[1]), 11, 31));
  const d = new Date(period);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

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
    const result = await fetchAbsSeries({
      flowRef: spec.api.flowRef,
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
      if (latest) {
        return {
          metricKey: spec.scrape.metricKey,
          label: spec.scrape.label,
          value: spec.api.format ? spec.api.format(latest.value) : String(latest.value),
          unit: spec.scrape.unit,
          context: spec.scrape.context,
          groupKey: spec.scrape.groupKey,
          source: "ABS",
          asOf: periodToDate(latest.period),
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
    // Switch this metric to the API by filling this in:
    //   pnpm probe:abs consumer price
    //   pnpm probe:abs --flow "<id from above>"
    // api: { flowRef: "ABS,...,1.0.0", dimensionFilter: { ... } },
    scrape: {
      url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release",
      metricKey: "cpi_trimmed",
      label: "Trimmed mean CPI",
      unit: "%",
      context: "ABS quarterly",
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
    // Switch this metric to the API by filling this in:
    //   pnpm probe:abs labour force
    //   pnpm probe:abs --flow "<id from above>"
    // api: { flowRef: "ABS,...,1.0.0", dimensionFilter: { ... } },
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
    // Switch this metric to the API by filling this in:
    //   pnpm probe:abs wage price
    //   pnpm probe:abs --flow "<id from above>"
    // api: { flowRef: "ABS,...,1.0.0", dimensionFilter: { ... } },
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
    // Switch this metric to the API by filling this in:
    //   pnpm probe:abs building approvals
    //   pnpm probe:abs --flow "<id from above>"
    // api: { flowRef: "ABS,...,1.0.0", dimensionFilter: { ... } },
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
    // Switch this metric to the API by filling this in:
    //   pnpm probe:abs migration
    //   pnpm probe:abs --flow "<id from above>"
    // api: { flowRef: "ABS,...,1.0.0", dimensionFilter: { ... } },
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
