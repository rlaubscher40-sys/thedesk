/**
 * Daily metrics ingest. Runs once a day on GitHub Actions.
 *
 * Pulls:
 *   - Yahoo Finance for market prices (ASX 200, FX pairs, US 10Y)
 *   - RBA's official CSVs for the cash rate target and housing lending rates
 *   - ABS latest-release pages for CPI, unemployment, wage growth,
 *     building approvals, net migration
 *
 * POSTs everything to /api/ingest/daily-metrics in one batch.
 *
 * Required env:
 *   INGEST_BASE_URL    — the deployed site URL
 *   SCHEDULED_API_KEY  — matches server-side env var
 */
import { fetchAuctionMetrics } from "./lib/auctionClearance";
import { fetchPropertyReleaseMetrics } from "./lib/propertyReleases";
import { fetchCashRate, CASH_RATE_CSV } from "./lib/rbaCashRate";
import { collectionDeadline } from "./lib/deadline";
import { fetchAllAbs } from "./lib/abs";
import { postJSON } from "./lib/post";
import { getStateDemographics } from "../../server/markets/absDemographics";
import { stateDemographicMetrics } from "../../shared/stateDemographicMetrics";
import { getCityApprovals } from "../../server/markets/absApprovals";
import {
  annualApprovals,
  approvalGeography,
  APPROVAL_SOURCE,
  APPROVAL_REGIONS,
} from "../../shared/cityApprovals";
import { getCityRents } from "../../server/markets/absRents";
import { cityRentMetrics } from "../../shared/cityRentMetrics";
import { rentPeriod } from "../../shared/cityRents";
import { fetchRbaHousingRateMetrics } from "./lib/rbaHousingRates";

export type MetricOut = {
  metricKey: string;
  label: string;
  value: string;
  unit?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  context?: string | null;
  groupKey?: string | null;
  asOf: string;
  displayOrder?: number;
};

/**
 * Yahoo Finance unofficial chart endpoint — has been stable for years.
 * Returns the latest close + previous close.
 */
async function fetchYahooQuote(symbol: string): Promise<{
  price: number;
  asOf: Date;
} | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TheDeskBot/1.0; +https://thedesk.au)",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`[metrics] yahoo ${symbol} → ${res.status}`);
      return null;
    }
    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: { regularMarketPrice?: number; regularMarketTime?: number };
          indicators?: { quote?: Array<{ close?: Array<number | null> }> };
          timestamp?: number[];
        }>;
      };
    };
    const r = json.chart?.result?.[0];
    if (!r) return null;
    const price =
      r.meta?.regularMarketPrice ??
      r.indicators?.quote?.[0]?.close?.filter((c): c is number => c !== null).pop();
    if (typeof price !== "number" || !Number.isFinite(price)) return null;
    const tsSeconds = r.meta?.regularMarketTime ?? r.timestamp?.[r.timestamp.length - 1];
    const asOf = tsSeconds ? new Date(tsSeconds * 1000) : new Date();
    return { price, asOf };
  } catch (err) {
    console.warn(`[metrics] yahoo ${symbol} error:`, (err as Error).message);
    return null;
  }
}

function fmtNumber(n: number, decimals = 2): string {
  return n.toLocaleString("en-AU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Run the daily-metrics ingest against `rawBaseUrl` (deployed site for the
 * GitHub Action, or http://127.0.0.1:<port> for the in-process scheduler).
 * Pure: no env reads, no process.exit, so the server can import it.
 */
/** A 200 response with partial writes must not mark the collection healthy. */
export function verifyMetricReceipt(result: unknown, expected: number): void {
  const receipt = result as { success?: unknown; count?: unknown } | null;
  if (!receipt || receipt.success !== true || receipt.count !== expected) {
    throw new Error(`[metrics] incomplete persistence: expected ${expected} metrics`);
  }
}

export async function runDailyMetricsIngest(
  rawBaseUrl: string,
  apiKey: string,
  options: {
    /** Retained for older callers. Managed metrics now always use publisher readers. */
    extractFromNews?: boolean;
    persist?: (metrics: MetricOut[]) => Promise<void>;
    onSourceError?: (metricKey: string, reason: string) => void;
  } = {}
): Promise<void> {
  const baseUrl = rawBaseUrl.replace(/\/+$/u, "");

  console.log("[metrics] fetching from Yahoo Finance + RBA...");

  const [
    cashRate,
    housingRates,
    asx,
    audusd,
    audgbp,
    audeur,
    us10y,
    absResults,
    approvals,
    demographics,
    rents,
    auctions,
    releases,
  ] = await Promise.all([
    fetchCashRate((reason) => options.onSourceError?.("cash_rate", reason)),
    fetchRbaHousingRateMetrics(),
    fetchYahooQuote("^AXJO"), // ASX 200
    fetchYahooQuote("AUDUSD=X"),
    fetchYahooQuote("AUDGBP=X"),
    fetchYahooQuote("AUDEUR=X"),
    fetchYahooQuote("^TNX"), // US 10Y treasury yield
    collectionDeadline(fetchAllAbs(), [], 45_000),
    getCityApprovals(),
    getStateDemographics(),
    getCityRents(),
    fetchAuctionMetrics(options.onSourceError),
    fetchPropertyReleaseMetrics(options.onSourceError),
  ]);

  const metrics: MetricOut[] = [];

  if (cashRate) {
    metrics.push({
      metricKey: "cash_rate",
      label: "RBA cash rate",
      value: fmtNumber(cashRate.rate, 2),
      unit: "%",
      source: "RBA",
      sourceUrl: CASH_RATE_CSV,
      groupKey: "MACRO",
      asOf: cashRate.asOf.toISOString(),
      displayOrder: 10,
    });
  }

  metrics.push(...housingRates);

  if (asx) {
    metrics.push({
      metricKey: "asx200",
      label: "ASX 200",
      value: fmtNumber(asx.price, 2),
      unit: null,
      source: "Yahoo Finance",
      groupKey: "MARKETS",
      asOf: asx.asOf.toISOString(),
      displayOrder: 90,
    });
  }

  if (audusd) {
    metrics.push({
      metricKey: "audusd",
      label: "AUD / USD",
      value: fmtNumber(audusd.price, 4),
      unit: null,
      source: "Yahoo Finance",
      groupKey: "MARKETS",
      asOf: audusd.asOf.toISOString(),
      displayOrder: 100,
    });
  }

  if (audgbp) {
    metrics.push({
      metricKey: "audgbp",
      label: "AUD / GBP",
      value: fmtNumber(audgbp.price, 4),
      unit: null,
      source: "Yahoo Finance",
      groupKey: "MARKETS",
      asOf: audgbp.asOf.toISOString(),
      displayOrder: 105,
    });
  }

  if (audeur) {
    metrics.push({
      metricKey: "audeur",
      label: "AUD / EUR",
      value: fmtNumber(audeur.price, 4),
      unit: null,
      source: "Yahoo Finance",
      groupKey: "MARKETS",
      asOf: audeur.asOf.toISOString(),
      displayOrder: 110,
    });
  }

  if (us10y) {
    metrics.push({
      metricKey: "us10y",
      label: "US 10Y yield",
      value: fmtNumber(us10y.price, 2),
      unit: "%",
      source: "Yahoo Finance",
      groupKey: "MARKETS",
      asOf: us10y.asOf.toISOString(),
      displayOrder: 115,
    });
  }

  // ── ABS scrapes (CPI, unemployment, WPI, building approvals, NOM) ───────
  console.log("[metrics] scraping ABS...");
  for (const r of absResults) {
    if (!r) continue;
    metrics.push({
      metricKey: r.metricKey,
      label: r.label,
      value: r.value,
      unit: r.unit || null,
      source: r.source,
      context: r.context,
      groupKey: r.groupKey,
      asOf: r.asOf.toISOString(),
      displayOrder: r.displayOrder,
    });
  }
  console.log(`[metrics] ABS yielded ${absResults.filter(Boolean).length}/${absResults.length}`);

  for (const [index, city] of Object.values(APPROVAL_REGIONS).entries()) {
    const read = annualApprovals(approvals, city, new Date().toISOString());
    if (!read) continue;
    metrics.push({
      metricKey: `${city.toLowerCase()}_approvals_12m`,
      label: `${city} approvals (12m)`,
      value: String(read.total),
      unit: "",
      source: "ABS BA_GCCSA · original series",
      sourceUrl: APPROVAL_SOURCE,
      groupKey: "PROPERTY",
      context: `${approvalGeography(city)} · year to ${rentPeriod(read.period)}. Approved dwelling units, not completions or available stock.${read.preliminary ? " Includes preliminary data." : ""}${read.revised ? " Includes revised data." : ""}`,
      asOf: `${read.period}-01T00:00:00.000Z`,
      displayOrder: 61 + index,
    });
  }

  metrics.push(...stateDemographicMetrics(demographics, new Date().toISOString().slice(0, 10)));

  metrics.push(...cityRentMetrics(rents));

  metrics.push(...auctions, ...releases);

  if (metrics.length === 0) {
    throw new Error("[metrics] all sources failed; nothing to ship");
  }

  console.log(`[metrics] collected ${metrics.length} metrics, POSTing...`);
  for (const m of metrics) {
    console.log(`  - ${m.label}: ${m.value}${m.unit ?? ""} (${m.source})`);
  }

  if (options.persist) {
    await options.persist(metrics);
  } else {
    const result = await postJSON(`${baseUrl}/api/ingest/daily-metrics`, { metrics }, apiKey);
    console.log("[metrics] server response:", result);
    verifyMetricReceipt(result, metrics.length);
  }

  console.log("[metrics] done.");
}

async function main(): Promise<void> {
  const baseUrl = process.env.INGEST_BASE_URL;
  const apiKey = process.env.SCHEDULED_API_KEY;
  if (!baseUrl) throw new Error("INGEST_BASE_URL is required");
  if (!apiKey) throw new Error("SCHEDULED_API_KEY is required");
  await runDailyMetricsIngest(baseUrl, apiKey);
}

// CLI entrypoint only (pnpm ingest:metrics sets INGEST_CLI=1); never runs when
// the server imports this module for the in-process scheduler.
if (process.env.INGEST_CLI === "1") {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
