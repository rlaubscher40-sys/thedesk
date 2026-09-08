import {
  AUCTION_REGIONS,
  AUCTION_SOURCE,
  nationalAuctionResult,
  type AuctionRegion,
  type AuctionResult,
} from "../../../shared/auctionClearance";
import type { MetricOut } from "../dailyMetrics";
import {
  PublisherRateLimitError,
  requireRecent,
  sourceDate,
  sourceHtml,
  sourceText,
} from "./publishedSources";

export function parseAuctionResults(
  html: string,
  region: AuctionRegion,
  now = new Date(),
): AuctionResult {
  const text = sourceText(html).split("Non-auction sales")[0]!;
  if (!text.includes(`${region} clearance rate`))
    throw new Error(`Missing ${region} statewide summary`);
  const period = text.match(
    /Mon (\d{1,2}) ([A-Za-z]{3}) (\d{4})\s*[-–]\s*Sun (\d{1,2}) ([A-Za-z]{3}) (\d{4})/,
  );
  if (!period) throw new Error("Missing auction reporting week");
  const start = sourceDate(period[1]!, period[2]!, period[3]!);
  const weekEnding = sourceDate(period[4]!, period[5]!, period[6]!);
  if (
    Date.parse(weekEnding) - Date.parse(start) !== 6 * 86_400_000 ||
    new Date(weekEnding).getUTCDay() !== 0
  )
    throw new Error("Invalid auction reporting week");
  requireRecent(weekEnding, 14, now);
  const count = (pattern: RegExp) => {
    const matches = [...text.matchAll(pattern)];
    if (matches.length !== 1)
      throw new Error("Missing or ambiguous auction count");
    const n = Number(matches[0]![1]!.replaceAll(",", ""));
    if (!Number.isSafeInteger(n) || n < 0 || n > 100_000)
      throw new Error("Invalid auction count");
    return n;
  };
  const sold =
    count(/\b([\d,]+) Sold at auction\b/g) +
    count(/\b([\d,]+) Sold prior to auction\b/g) +
    count(/\b([\d,]+) Sold after auction\b/g);
  const reported = count(/Based on ([\d,]+) auction results? available/g);
  const scheduled = count(/\b([\d,]+) auctions? scheduled\b/g);
  if (
    sold +
      count(/\b([\d,]+) Withdrawn\b/g) +
      count(/\b([\d,]+) Passed in\b/g) !==
      reported ||
    reported > scheduled
  )
    throw new Error("Auction counts do not reconcile");
  return { region, weekEnding, sold, reported, scheduled };
}

function metric(
  row: Omit<AuctionResult, "region">,
  region: AuctionRegion | "Australia",
): MetricOut {
  const rate = row.reported ? (100 * row.sold) / row.reported : null;
  return {
    metricKey:
      region === "Australia"
        ? "auction_clearance"
        : `${region.toLowerCase()}_auction_clearance`,
    label: `${region} auction clearance`,
    value: rate === null ? "No reported auctions" : rate.toFixed(1),
    unit: rate === null ? null : "%",
    source: AUCTION_SOURCE,
    sourceUrl: `https://www.realestate.com.au/auction-results/${region === "Australia" ? "" : region.toLowerCase()}`,
    asOf: row.weekEnding,
    groupKey: "PROPERTY",
    displayOrder:
      region === "Australia" ? 50 : 150 + AUCTION_REGIONS.indexOf(region),
    context:
      `Preliminary, week ending ${row.weekEnding}. ${row.sold} sold / ${row.reported} reported; ${row.scheduled} scheduled. ` +
      (region === "Australia"
        ? "The Desk weighted average across all eight states and territories. "
        : "State/territory coverage. ") +
      "Sold includes before, at and after auction; reported includes withdrawn and passed in." +
      (row.reported < 10
        ? " Small sample: fewer than 10 reported outcomes."
        : ""),
  };
}

type Collection = {
  metrics: MetricOut[];
  errors: Array<{ key: string; reason: string }>;
};
const HOUR = 3_600_000;

/** One shared, paced collection for Admin and scheduler calls in this process.
 * A rate limit stops the whole publisher batch, including later manual retries.
 * This does not change network identities or bypass publisher access controls. */
export function createAuctionCollector(
  options: {
    fetchPage?: (url: string) => Promise<string>;
    now?: () => number;
    delay?: (ms: number) => Promise<void>;
  } = {},
) {
  const fetchPage = options.fetchPage ?? sourceHtml;
  const now = options.now ?? Date.now;
  const delay =
    options.delay ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let pending: Promise<Collection> | null = null;
  let last: Collection | null = null;
  let nextAttemptAt = 0;
  let limits = 0;

  async function collect(): Promise<Collection> {
    const rows: AuctionResult[] = [];
    const errors: Collection["errors"] = [];
    let limited = false;
    for (const region of AUCTION_REGIONS) {
      try {
        if (rows.length || errors.length) await delay(1000);
        rows.push(
          parseAuctionResults(
            await fetchPage(
              `https://www.realestate.com.au/auction-results/${region.toLowerCase()}`,
            ),
            region,
            new Date(now()),
          ),
        );
      } catch (error) {
        if (error instanceof PublisherRateLimitError) {
          limits++;
          // At least an hour, increasing after repeated 429s, but always honour
          // a longer Retry-After. Do not sleep or retry within this request.
          nextAttemptAt = Math.max(
            error.retryAt,
            now() + Math.min(24, 2 ** Math.min(limits - 1, 5)) * HOUR,
          );
          errors.push({
            key: "auction_clearance",
            reason: `Auction publisher rate-limited this server (HTTP 429). Collection stopped; next eligible attempt ${new Date(nextAttemptAt).toISOString()}. Existing results retained. Repeated refreshes will not retry during this pause.`,
          });
          limited = true;
          break;
        }
        errors.push({
          key: `${region.toLowerCase()}_auction_clearance`,
          reason: (error as Error).message,
        });
      }
    }
    const metrics = rows.map((row) => metric(row, row.region));
    const national = nationalAuctionResult(rows);
    if (national) metrics.push(metric(national, "Australia"));
    else if (!limited)
      errors.push({
        key: "auction_clearance",
        reason:
          "All eight states and territories must return reconciled counts for the same week; national value retained.",
      });
    if (!limited) {
      limits = 0;
      // Success is reusable for six hours. Other failures wait an hour too.
      nextAttemptAt = now() + (national ? 6 : 1) * HOUR;
    }
    last = { metrics, errors };
    return last;
  }

  return async (
    onError?: (key: string, reason: string) => void,
  ): Promise<MetricOut[]> => {
    let result: Collection;
    if (pending) result = await pending;
    else if (last && now() < nextAttemptAt) {
      // Do not re-save partial results during a failed collection's cooldown:
      // preserve their real last-stored timestamp and keep gaps visible.
      result = last.errors.length ? { metrics: [], errors: last.errors } : last;
      if (
        !result.errors.length &&
        result.metrics.some((row) => {
          try {
            requireRecent(row.asOf, 14, new Date(now()));
            return false;
          } catch {
            return true;
          }
        })
      )
        result = {
          metrics: [],
          errors: [
            {
              key: "auction_clearance",
              reason:
                "Cached auction reporting period needs review; existing results retained.",
            },
          ],
        };
    } else {
      pending = collect().finally(() => {
        pending = null;
      });
      result = await pending;
    }
    result.errors.forEach((error) => onError?.(error.key, error.reason));
    return result.metrics.map((row) => ({ ...row }));
  };
}

export const fetchAuctionMetrics = createAuctionCollector();
