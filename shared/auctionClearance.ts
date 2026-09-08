export const AUCTION_REGIONS = [
  "NSW",
  "VIC",
  "QLD",
  "SA",
  "WA",
  "TAS",
  "ACT",
  "NT",
] as const;
export type AuctionRegion = (typeof AUCTION_REGIONS)[number];
export const AUCTION_SOURCE = "realestate.com.au · reported auction outcomes";
export type AuctionResult = {
  region: AuctionRegion;
  weekEnding: string;
  sold: number;
  reported: number;
  scheduled: number;
};

/** Never average rounded percentages or combine different reporting weeks. */
export function nationalAuctionResult(rows: AuctionResult[]) {
  if (
    rows.length !== AUCTION_REGIONS.length ||
    AUCTION_REGIONS.some(
      (region) => rows.filter((row) => row.region === region).length !== 1,
    ) ||
    new Set(rows.map((row) => row.weekEnding)).size !== 1 ||
    rows.some(
      (row) =>
        ![row.sold, row.reported, row.scheduled].every(
          (n) => Number.isSafeInteger(n) && n >= 0,
        ) ||
        row.sold > row.reported ||
        row.reported > row.scheduled,
    )
  )
    return null;
  const sold = rows.reduce((sum, row) => sum + row.sold, 0);
  const reported = rows.reduce((sum, row) => sum + row.reported, 0);
  const scheduled = rows.reduce((sum, row) => sum + row.scheduled, 0);
  return {
    weekEnding: rows[0]!.weekEnding,
    sold,
    reported,
    scheduled,
    rate: reported ? (100 * sold) / reported : null,
  };
}
