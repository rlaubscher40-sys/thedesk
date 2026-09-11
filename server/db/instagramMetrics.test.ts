import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ set: vi.fn(), where: vi.fn(), limit: vi.fn() }));
vi.mock("./client", () => ({
  getDb: () => ({
    update: () => ({ set: m.set }),
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: m.limit }) }) }) }),
  }),
}));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
import { listInstagramPostsNeedingMetrics, updateInstagramPostMetrics } from "./instagramPosts";
afterEach(() => vi.useRealTimers());
beforeEach(() => {
  vi.clearAllMocks();
  m.set.mockReturnValue({ where: m.where });
  m.where.mockResolvedValue([]);
});
it("recovers partial snapshots despite a fetch timestamp, skips complete rows and caps the batch", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-08T12:00:00Z"));
  const complete = {
    createdAt: new Date("2026-09-07T00:00:00Z"),
    metricsFetchedAt: new Date("2026-09-08T06:00:00Z"),
    likes: 0,
    comments: 0,
    reach: 10,
    saved: 0,
    shares: 0,
  };
  const partial = Array.from({ length: 25 }, (_, i) => ({
    ...complete,
    mediaId: String(i),
    saved: null,
  }));
  m.limit.mockResolvedValue([{ ...complete, mediaId: "done" }, ...partial]);
  const rows = await listInstagramPostsNeedingMetrics();
  expect(rows).toEqual(partial.slice(0, 20));
  expect(m.limit).toHaveBeenCalledWith(200);
});
it("does not erase a prior reading or mark a wholly failed request as fetched", async () => {
  await updateInstagramPostMetrics("123", {
    likes: null,
    comments: null,
    reach: null,
    saved: null,
    shares: null,
    totalInteractions: null,
  });
  expect(m.set).not.toHaveBeenCalled();
});
it("records an inaccessible attempt without erasing a valid historical snapshot", async () => {
  expect(
    await updateInstagramPostMetrics(
      "123",
      {},
      { status: "unavailable", reason: "media_unavailable" }
    )
  ).toBe(true);
  expect(m.set).toHaveBeenCalledWith({
    firstDayMetrics: expect.anything(),
    metricsAttemptedAt: expect.any(Date),
    metricsStatus: "unavailable",
    metricsError: "media_unavailable",
  });
});
it("does not report a failed database write as persisted", async () => {
  m.where.mockRejectedValueOnce(new Error("database unavailable"));
  expect(
    await updateInstagramPostMetrics(
      "123",
      {},
      { status: "failed", reason: "provider_unavailable" }
    )
  ).toBe(false);
});
it("surfaces a diagnostic query failure instead of claiming zero posts need metrics", async () => {
  m.limit.mockRejectedValueOnce(new Error("database unavailable"));
  await expect(listInstagramPostsNeedingMetrics(undefined, true)).rejects.toThrow("query failed");
});
it("stores a single coherent snapshot and preserves zero versus missing", async () => {
  await updateInstagramPostMetrics("123", { likes: 0, reach: 10, saved: NaN });
  expect(m.set).toHaveBeenCalledWith({
    firstDayMetrics: expect.anything(),
    likes: 0,
    comments: null,
    reach: 10,
    saved: null,
    shares: null,
    totalInteractions: null,
    metricsFetchedAt: expect.any(Date),
  });
});
