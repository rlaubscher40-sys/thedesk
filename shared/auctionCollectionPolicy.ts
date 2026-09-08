import { AUCTION_REGIONS } from "./auctionClearance";

// Explicit owner decision: do not use PropTrack/REA. No timer or deployment
// should reactivate the former reader. Replace this policy only after an
// approved alternative feed and its methodology are implemented and verified.
export const PAUSED_AUCTION_KEYS: readonly string[] = [
  "auction_clearance",
  ...AUCTION_REGIONS.map(
    (region) => `${region.toLowerCase()}_auction_clearance`,
  ),
];
export const AUCTION_PAUSE_REASON =
  "Auction collection is paused: PropTrack/REA is excluded and approved alternative data access is pending. Existing observations are retained; missing figures remain unavailable.";

export function isAuctionCollectionPaused(key: string) {
  return PAUSED_AUCTION_KEYS.includes(key);
}
