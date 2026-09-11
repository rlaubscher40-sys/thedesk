import { beforeEach, it, expect, vi } from "vitest";
const fetchRates = vi.hoisted(() => vi.fn());
vi.mock("../../scripts/ingest/lib/rbaHousingRates", () => ({ fetchRbaHousingRates: fetchRates }));
import { getReelLendingRates } from "./reelLendingRates";
import { invalidate } from "../core/cache";
beforeEach(() => {
  invalidate("reels:rba-f6");
  fetchRates.mockReset();
});
it("shares a single monthly-source attempt between concurrent callers and caches failure", async () => {
  fetchRates.mockResolvedValue([]);
  expect(await Promise.all([getReelLendingRates(), getReelLendingRates()])).toEqual([[], []]);
  await getReelLendingRates();
  expect(fetchRates).toHaveBeenCalledTimes(1);
});
