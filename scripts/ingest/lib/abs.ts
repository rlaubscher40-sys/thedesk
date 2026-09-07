/**
 * ABS metrics use a pinned flow and explicit dimension filter when verified.
 * Name/range-based discovery is for investigation only: a plausible value
 * cannot prove geography, adjustment, measure or unit. Unverified configs
 * retain the dated release-page fallback rather than publish a guessed series.
 */

import { fetchAbsSeries, latestObservation } from "./absApi";
import type { DiscoverSpec } from "./absDiscover";

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
   * Verified flow reference from the ABS catalogue. Without this and a
   * dimension filter, production uses the release-page fallback.
   */
  flowRef?: string;
  /** Legacy discovery hint retained for probes; never authorizes live data. */
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
    const flowRef = spec.api.flowRef;
    if (!flowRef || !Object.keys(spec.api.dimensionFilter ?? {}).length) {
      console.warn(
        `[abs] ${spec.scrape.metricKey}: no verified series contract; falling back to the scrape.`
      );
      return scrapeAbs(spec.scrape);
    }

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
      // Even a pinned flow contains many series. Never take the last row of
      // two different measures simply because both happen to be plausible.
      const identities = new Set(
        matching.map((row) =>
          JSON.stringify(
            Object.entries(row.dimensions)
              .filter(([key]) => !["OBS_STATUS", "OBS_COMMENT"].includes(key))
              .sort(([a], [b]) => a.localeCompare(b))
          )
        )
      );
      const latest = identities.size === 1 ? latestObservation(matching) : null;
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
