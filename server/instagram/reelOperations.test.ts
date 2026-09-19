import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  history: vi.fn(),
  metrics: vi.fn(),
  source: vi.fn(),
  review: vi.fn(),
  receipt: vi.fn(),
}));
vi.mock("../db/reelHistory", () => ({ readRecentReelPublications: m.history }));
vi.mock("../db/instagramPosts", () => ({ readReelMetricPosts: m.metrics }));
vi.mock("../db/reelStorySource", () => ({ readReelStorySource: m.source }));
vi.mock("../db/reelReviews", () => ({ readReelReview: m.review }));
vi.mock("./reelStatus", () => ({ reelPublicationRecord: m.receipt }));
import { readReelOperations } from "./reelOperations";
import { captureReelRender } from "../video/reelRenderRecord";
const publishedAt = new Date("2026-09-01T00:00:00Z");
const receipt = {
  key: "instagram-reel-abs-rents-brisbane-perth-v1",
  date: "2026-07-01",
  postId: "123",
  publishedAt,
};
const render = {
  ...captureReelRender(
    { bytes: Buffer.from("video"), seconds: 35, narrated: true, subtitled: true },
    Buffer.from("cover"),
    { label: "Rents", value: "1", line: "Evidence" },
    { voice: "bm_fable", speed: 1 }
  ),
  recipe: "rent-comparison",
};
beforeEach(() => {
  vi.resetAllMocks();
  m.history.mockResolvedValue([receipt]);
  m.review.mockResolvedValue(null);
  m.receipt.mockResolvedValue({ state: "available" });
  m.source.mockResolvedValue({ render });
  m.metrics.mockResolvedValue([
    {
      mediaId: "123",
      headline: "Rents",
      metricsFetchedAt: new Date("2026-09-02T01:00:00Z"),
      reach: 100,
      saved: 2,
      shares: 1,
    },
  ]);
});
it("joins audience counts and recorded old voice to the exact confirmed ID without today's defaults", async () => {
  const report = await readReelOperations(new Date("2026-09-19T00:00:00Z"));
  expect(m.metrics).toHaveBeenCalledWith(["123"]);
  expect(m.source).toHaveBeenCalledWith(receipt);
  expect(m.review).toHaveBeenCalledWith({
    publication: { key: receipt.key, date: receipt.date },
    postId: "123",
    videoSha256: render.videoSha256,
  });
  expect(report.learning.cohorts[0]).toMatchObject({
    profile: "delivery-unrecorded",
    voice: "local-kokoro/bm_fable/1",
    savesPerThousand: 20,
  });
  expect(report.posts[0]?.reviewState).toBe("not-recorded");
  expect(report.runway.needsProduction).toBe(true);
});
it("does not borrow another post's counts or assign unrecorded render settings", async () => {
  m.source.mockResolvedValue(null);
  m.metrics.mockResolvedValue([{ mediaId: "999", reach: 999999, saved: 3000 }]);
  const report = await readReelOperations();
  expect(report.posts[0]).toMatchObject({
    render: null,
    measurement: null,
    sourceState: "not-recorded",
  });
  expect(report.learning.cohorts).toEqual([]);
  expect(m.review).not.toHaveBeenCalled();
});
it("preserves publication confirmation when individual review/provenance storage fails", async () => {
  m.review.mockRejectedValue(new Error("DB down"));
  expect((await readReelOperations()).posts[0]).toMatchObject({
    postId: "123",
    reviewState: "unavailable",
    sourceState: "recorded",
  });
  m.source.mockRejectedValue(new Error("DB down"));
  expect((await readReelOperations()).posts[0]).toMatchObject({
    postId: "123",
    sourceState: "unavailable",
    render: null,
  });
  m.history.mockRejectedValue(new Error("History unavailable"));
  await expect(readReelOperations()).rejects.toThrow("History unavailable");
});
