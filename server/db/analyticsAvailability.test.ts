import { expect, it, vi } from "vitest";
vi.mock("./client", () => ({ getDb: () => null }));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
import {
  pageViewSummary,
  topPaths,
  topReferrers,
  pageViewsByDay,
  engagementSummary,
  readerJourney,
} from "./analytics";
it("does not turn an unavailable data store into zero readership", async () => {
  for (const result of [
    pageViewSummary(24),
    topPaths(24),
    topReferrers(24),
    pageViewsByDay(7),
    engagementSummary(24),
  ])
    await expect(result).rejects.toThrow("unavailable");
  expect(await readerJourney()).toEqual({ available: false });
});
