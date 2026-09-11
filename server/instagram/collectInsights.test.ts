import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn(), fetch: vi.fn() }));
vi.mock("../db/instagramPosts", () => ({
  listInstagramPostsNeedingMetrics: m.list,
  updateInstagramPostMetrics: m.save,
}));
vi.mock("./api", () => ({ fetchMediaMetricsResult: m.fetch }));
import { collectInstagramInsights } from "./collectInsights";
beforeEach(() => {
  vi.resetAllMocks();
  m.save.mockResolvedValue(true);
  m.list.mockResolvedValue([{ mediaId: "1" }, { mediaId: "2" }]);
});
it("continues past inaccessible media and counts confirmed reads separately", async () => {
  m.fetch
    .mockResolvedValueOnce({ status: "unavailable", reason: "media_unavailable", metrics: {} })
    .mockResolvedValueOnce({ status: "complete", reason: null, metrics: { likes: 0 } });
  expect(await collectInstagramInsights("private-token")).toEqual({
    selected: 2,
    complete: 1,
    partial: 0,
    unavailable: 1,
    failed: 0,
    deferred: 0,
    persistenceFailed: 0,
  });
  expect(m.save).toHaveBeenCalledTimes(2);
});
it.each(["rate_limited", "access_denied"])(
  "defers remaining reads for account-wide %s",
  async (reason) => {
    m.fetch.mockResolvedValue({ status: "failed", reason, metrics: {} });
    expect(await collectInstagramInsights("private-token")).toMatchObject({
      selected: 2,
      failed: 1,
      deferred: 1,
    });
    expect(m.fetch).toHaveBeenCalledOnce();
  }
);
it("reports persistence failure without conflating it with a provider failure", async () => {
  m.fetch.mockResolvedValue({ status: "complete", reason: null, metrics: { likes: 0 } });
  m.save.mockResolvedValueOnce(false);
  expect(await collectInstagramInsights("private-token")).toMatchObject({
    complete: 2,
    persistenceFailed: 1,
  });
});
it("does not fabricate an empty success when the post query fails", async () => {
  m.list.mockRejectedValue(new Error("database unavailable"));
  await expect(collectInstagramInsights("private-token")).rejects.toThrow("database unavailable");
  expect(m.fetch).not.toHaveBeenCalled();
});
