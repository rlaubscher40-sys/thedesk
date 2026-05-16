/**
 * Daily metrics ingest. Runs once a day on GitHub Actions.
 *
 * Pulls market data from Yahoo Finance (no auth required, stable for
 * years) and the RBA cash rate from the RBA homepage. POSTs everything
 * to /api/ingest/daily-metrics.
 *
 * Required env:
 *   INGEST_BASE_URL    — the deployed site URL
 *   SCHEDULED_API_KEY  — matches server-side env var
 */
import { postJSON } from "./lib/post";

type MetricOut = {
  metricKey: string;
  label: string;
  value: string;
  unit?: string | null;
  source?: string | null;
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
        "User-Agent":
          "Mozilla/5.0 (compatible; TheDeskBot/1.0; +https://thedesk.com.au)",
      },
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

/**
 * Scrape the current RBA cash rate from rba.gov.au. The homepage shows
 * "Cash Rate Target: X.XX%" prominently — a regex against the rendered
 * HTML is more reliable than trying to find an API.
 */
async function fetchCashRate(): Promise<{ rate: number; asOf: Date } | null> {
  try {
    const res = await fetch("https://www.rba.gov.au/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TheDeskBot/1.0; +https://thedesk.com.au)",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/[Cc]ash [Rr]ate [Tt]arget[^0-9]*([0-9]+\.[0-9]+)\s*%/);
    if (!m) {
      console.warn("[metrics] cash rate pattern not found on RBA homepage");
      return null;
    }
    const rate = Number(m[1]);
    if (!Number.isFinite(rate)) return null;
    return { rate, asOf: new Date() };
  } catch (err) {
    console.warn("[metrics] cash rate fetch error:", (err as Error).message);
    return null;
  }
}

function fmtNumber(n: number, decimals = 2): string {
  return n.toLocaleString("en-AU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

async function main(): Promise<void> {
  const baseUrl = process.env.INGEST_BASE_URL?.replace(/\/+$/, "");
  const apiKey = process.env.SCHEDULED_API_KEY;
  if (!baseUrl) throw new Error("INGEST_BASE_URL is required");
  if (!apiKey) throw new Error("SCHEDULED_API_KEY is required");

  console.log("[metrics] fetching from Yahoo Finance + RBA...");

  const [cashRate, asx, audusd, audgbp, audeur, us10y] = await Promise.all([
    fetchCashRate(),
    fetchYahooQuote("^AXJO"), // ASX 200
    fetchYahooQuote("AUDUSD=X"),
    fetchYahooQuote("AUDGBP=X"),
    fetchYahooQuote("AUDEUR=X"),
    fetchYahooQuote("^TNX"), // US 10Y treasury yield
  ]);

  const metrics: MetricOut[] = [];

  if (cashRate) {
    metrics.push({
      metricKey: "cash_rate",
      label: "RBA cash rate",
      value: fmtNumber(cashRate.rate, 2),
      unit: "%",
      source: "RBA",
      asOf: cashRate.asOf.toISOString(),
      displayOrder: 10,
    });
  }

  if (asx) {
    metrics.push({
      metricKey: "asx200",
      label: "ASX 200",
      value: fmtNumber(asx.price, 2),
      unit: null,
      source: "Yahoo Finance",
      asOf: asx.asOf.toISOString(),
      displayOrder: 20,
    });
  }

  if (audusd) {
    metrics.push({
      metricKey: "audusd",
      label: "AUD / USD",
      value: fmtNumber(audusd.price, 4),
      unit: null,
      source: "Yahoo Finance",
      asOf: audusd.asOf.toISOString(),
      displayOrder: 30,
    });
  }

  if (audgbp) {
    metrics.push({
      metricKey: "audgbp",
      label: "AUD / GBP",
      value: fmtNumber(audgbp.price, 4),
      unit: null,
      source: "Yahoo Finance",
      asOf: audgbp.asOf.toISOString(),
      displayOrder: 40,
    });
  }

  if (audeur) {
    metrics.push({
      metricKey: "audeur",
      label: "AUD / EUR",
      value: fmtNumber(audeur.price, 4),
      unit: null,
      source: "Yahoo Finance",
      asOf: audeur.asOf.toISOString(),
      displayOrder: 50,
    });
  }

  if (us10y) {
    metrics.push({
      metricKey: "us10y",
      label: "US 10Y yield",
      value: fmtNumber(us10y.price, 2),
      unit: "%",
      source: "Yahoo Finance",
      asOf: us10y.asOf.toISOString(),
      displayOrder: 60,
    });
  }

  if (metrics.length === 0) {
    throw new Error("[metrics] all sources failed; nothing to ship");
  }

  console.log(`[metrics] collected ${metrics.length} metrics, POSTing...`);
  for (const m of metrics) {
    console.log(`  - ${m.label}: ${m.value}${m.unit ?? ""} (${m.source})`);
  }

  const result = await postJSON(
    `${baseUrl}/api/ingest/daily-metrics`,
    { metrics },
    apiKey
  );
  console.log("[metrics] server response:", result);
  console.log("[metrics] done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
