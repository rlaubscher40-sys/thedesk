import { afterEach, expect, it, vi } from "vitest";
import {
  PAUSED_AUCTION_KEYS,
  isAuctionCollectionPaused,
} from "../../shared/auctionCollectionPolicy";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("keeps all nine auction metrics paused without disabling unrelated metrics", () => {
  expect(PAUSED_AUCTION_KEYS).toHaveLength(9);
  expect(new Set(PAUSED_AUCTION_KEYS).size).toBe(9);
  for (const key of PAUSED_AUCTION_KEYS)
    expect(isAuctionCollectionPaused(key)).toBe(true);
  expect(isAuctionCollectionPaused("cash_rate")).toBe(false);
});

it("never contacts the excluded publisher, including after module reinitialisation", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  for (let restart = 0; restart < 2; restart++) {
    vi.resetModules();
    const { fetchAuctionMetrics } = await import("./lib/auctionClearance");
    const report = vi.fn();
    expect(await fetchAuctionMetrics(report)).toEqual([]);
    expect(await fetchAuctionMetrics()).toEqual([]);
    expect(report).toHaveBeenCalledWith(
      "auction_clearance",
      expect.stringContaining("PropTrack/REA is excluded"),
    );
  }
  expect(fetch).not.toHaveBeenCalled();
});
