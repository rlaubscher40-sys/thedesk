import {
  AUCTION_REGIONS,
  AUCTION_SOURCE,
  nationalAuctionResult,
  type AuctionRegion,
  type AuctionResult,
} from "../../../shared/auctionClearance";
import type { MetricOut } from "../dailyMetrics";
import {
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

export async function fetchAuctionMetrics(
  onError?: (key: string, reason: string) => void,
): Promise<MetricOut[]> {
  const rows: AuctionResult[] = [];
  // Four requests at a time, across the same collection attempt. Never aggregate stored older states.
  for (let i = 0; i < AUCTION_REGIONS.length; i += 4) {
    await Promise.all(
      AUCTION_REGIONS.slice(i, i + 4).map(async (region) => {
        try {
          rows.push(
            parseAuctionResults(
              await sourceHtml(
                `https://www.realestate.com.au/auction-results/${region.toLowerCase()}`,
              ),
              region,
            ),
          );
        } catch (error) {
          onError?.(
            `${region.toLowerCase()}_auction_clearance`,
            (error as Error).message,
          );
        }
      }),
    );
  }
  const metrics = rows.map((row) => metric(row, row.region));
  const national = nationalAuctionResult(rows);
  if (national) metrics.push(metric(national, "Australia"));
  else
    onError?.(
      "auction_clearance",
      "All eight states and territories must return reconciled counts for the same week; national value retained.",
    );
  return metrics;
}
