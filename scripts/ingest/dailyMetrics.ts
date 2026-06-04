/**
 * Daily metrics ingest. Runs once a day on GitHub Actions.
 *
 * Pulls:
 *   - Yahoo Finance for market prices (ASX 200, FX pairs, US 10Y)
 *   - RBA's official CSV for the cash rate target
 *   - ABS latest-release pages for CPI, unemployment, wage growth,
 *     building approvals, net migration
 *
 * POSTs everything to /api/ingest/daily-metrics in one batch.
 *
 * Required env:
 *   INGEST_BASE_URL    — the deployed site URL
 *   SCHEDULED_API_KEY  — matches server-side env var
 */
import { fetchAllAbs } from "./lib/abs";
import { postJSON } from "./lib/post";

type MetricOut = {
  metricKey: string;
  label: string;
  value: string;
  unit?: string | null;
  source?: string | null;
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
        "User-Agent":
          "Mozilla/5.0 (compatible; TheDeskBot/1.0; +https://thedesk.au)",
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
 * Pull the current RBA cash rate from the official statistics CSV.
 * Format (from f1.1-data.csv):
 *   "Title","Cash Rate Target",...
 *   "Description","...",...
 *   "Frequency","Monthly",...
 *   ...metadata header rows...
 *   "31-Jan-1990",17.50,...
 *   ...one row per change of the target...
 *   "24-Jul-2024",4.35
 *
 * The last data row holds the current target. Far more reliable than
 * scraping the homepage, whose layout changes.
 */
async function fetchCashRate(): Promise<{ rate: number; asOf: Date } | null> {
  try {
    const res = await fetch(
      "https://www.rba.gov.au/statistics/tables/csv/f1.1-data.csv",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; TheDeskBot/1.0; +https://thedesk.au)",
        },
      }
    );
    if (!res.ok) {
      console.warn(`[metrics] RBA CSV → ${res.status}`);
      return null;
    }
    const csv = await res.text();
    // Walk the rows backwards; the first row that starts with a quoted
    // date like "DD-Mon-YYYY" is the most recent target.
    const lines = csv.split(/\r?\n/);
    const dateRe = /^"(\d{1,2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{4})"/i;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line) continue;
      const m = line.match(dateRe);
      if (!m) continue;
      const cells = line.split(",");
      const valueCell = cells[1]?.trim();
      if (!valueCell) continue;
      const rate = Number(valueCell);
      if (!Number.isFinite(rate)) continue;
      // Parse the date for asOf.
      const monthIdx = [
        "jan", "feb", "mar", "apr", "may", "jun",
        "jul", "aug", "sep", "oct", "nov", "dec",
      ].indexOf(m[2]!.toLowerCase());
      const asOf = new Date(Date.UTC(Number(m[3]), monthIdx, Number(m[1])));
      return { rate, asOf };
    }
    console.warn("[metrics] RBA CSV had no parseable data rows");
    return null;
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

/**
 * Run the daily-metrics ingest against `rawBaseUrl` (deployed site for the
 * GitHub Action, or http://127.0.0.1:<port> for the in-process scheduler).
 * Pure: no env reads, no process.exit, so the server can import it.
 */
export async function runDailyMetricsIngest(rawBaseUrl: string, apiKey: string): Promise<void> {
  const baseUrl = rawBaseUrl.replace(/\/+$/u, "");

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
      groupKey: "MACRO",
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
  const absResults = await fetchAllAbs();
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
  console.log(
    `[metrics] ABS yielded ${absResults.filter(Boolean).length}/${absResults.length}`
  );

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

  // ── News-driven LLM extraction for proprietary metrics ──────────────────
  // CoreLogic auction clearance / home value, Westpac-MI consumer sentiment,
  // APRA mortgage arrears are paywalled or buried in PDFs — but every release
  // gets covered by AFR/Property Observer/Domain etc. We ask the LLM to read
  // the most recent news coverage and pull the number out.
  console.log("[metrics] running news-driven extraction...");
  try {
    const extractResult = await postJSON(
      `${baseUrl}/api/ingest/extract-metrics`,
      {
        queries: [
          {
            metricKey: "auction_clearance",
            label: "Auction clearance",
            unit: "%",
            groupKey: "PROPERTY",
            displayOrder: 50,
            googleQuery:
              "Australia preliminary auction clearance rate CoreLogic Domain weekend results",
            guidance:
              "Find the most recent national, Sydney, or Melbourne preliminary or final auction clearance rate from CoreLogic or Domain. Return the headline percentage (e.g., 65.4). Prefer 'preliminary' rates from the most recent weekend.",
          },
          {
            metricKey: "dwelling_value",
            label: "Nat'l dwelling value",
            unit: null,
            groupKey: "PROPERTY",
            displayOrder: 40,
            googleQuery:
              "CoreLogic Home Value Index national median dwelling value Australia monthly",
            guidance:
              "Find the most recent national median dwelling value (in AUD) from CoreLogic's Home Value Index. Format the value with thousands separators and a leading $ (e.g., '$815,439'). If only a monthly change is reported, return null.",
          },
          {
            metricKey: "consumer_confidence",
            label: "Consumer confidence",
            unit: null,
            groupKey: "MACRO",
            displayOrder: 30,
            googleQuery:
              "Westpac Melbourne Institute consumer sentiment index Australia monthly",
            guidance:
              "Find the latest Westpac-Melbourne Institute Consumer Sentiment Index headline reading (e.g., 92.1). 100 = neutral; below means pessimism dominates. Return just the number.",
          },
          {
            metricKey: "mortgage_arrears",
            label: "Mortgage arrears",
            unit: "%",
            groupKey: "PROPERTY",
            displayOrder: 55,
            googleQuery:
              "Australia mortgage arrears rate APRA banks home loan 90 days past due",
            guidance:
              "Find the most recent home-loan arrears rate (90+ days past due) for Australian banks, reported by APRA or one of the big four. Return the percentage (e.g., 1.05).",
          },
        ],
      },
      apiKey
    );
    console.log("[metrics] extract response:", extractResult);
  } catch (err) {
    // News-driven extraction is best-effort. Don't fail the whole run.
    console.warn("[metrics] extract step failed:", (err as Error).message);
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
