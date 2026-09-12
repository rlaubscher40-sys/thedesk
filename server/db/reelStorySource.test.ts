import { expect, it, vi } from "vitest";
vi.mock("./client", () => ({ getDb: () => null }));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
import { reelStorySourceKey, expireReelStoryPreparation } from "./reelStorySource";
it("uses only the publication identity even when reading a complete history receipt", () => {
  const publication = { key: "reel-abs", date: "2026-07-01" };
  expect(
    reelStorySourceKey({ ...publication, ...{ postId: "123", publishedAt: new Date() } })
  ).toBe(reelStorySourceKey(publication));
  expect(reelStorySourceKey(publication).length).toBeLessThanOrEqual(64);
  expect(reelStorySourceKey({ ...publication, date: "2026-08-01" })).not.toBe(
    reelStorySourceKey(publication)
  );
});
it("never expires a Reel, Story publication lock, or unrelated job", async () => {
  for (const key of [
    "reel-story-publish-123",
    "instagram-reel-abs-sydney-before-buy-v1",
    "instagram-daily",
    "reel-story-prepare-not-an-id",
  ])
    await expect(expireReelStoryPreparation(key, "2026-07-01", new Date())).rejects.toThrow(
      "Only Story preparation"
    );
});
