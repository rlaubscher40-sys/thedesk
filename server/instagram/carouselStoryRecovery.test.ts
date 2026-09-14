import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  receipts: vi.fn(),
  read: vi.fn(),
  feed: vi.fn(),
  post: vi.fn(),
  assess: vi.fn(),
}));
vi.mock("../core/env", () => ({
  env: { instagramAccessToken: "fixture", instagramBusinessAccountId: "fixture" },
}));
vi.mock("../db/socialPublication", () => ({
  recentSocialReceipts: m.receipts,
  readSocialRecords: m.read,
}));
vi.mock("../db/feed", () => ({ getFeedItemsByIds: m.feed }));
vi.mock("./briefingSelection", () => ({ assessBriefingStory: m.assess }));
vi.mock("./sourceContent", () => ({ sourceGroundedStory: (s: unknown) => s }));
vi.mock("./post", () => ({ instagramCooldownActive: () => false, postStoryFrames: m.post }));
import { recoverCarouselStories } from "./carouselStoryRecovery";
import { carouselStoryKey } from "./carouselStoryReceipt";
const now = new Date("2026-09-14T08:35:00Z");
const receipt = {
  postId: "123",
  storyIds: [1, 2, 3],
  briefingVersion: "story-v2",
  storyFollowupVersion: 1,
  coverVariant: "light",
};
const row = { detail: JSON.stringify(receipt), finishedAt: new Date(now.getTime() - 3600_000) };
beforeEach(() => {
  vi.resetAllMocks();
  m.receipts.mockResolvedValue([row]);
  m.read.mockResolvedValue([]);
  m.feed.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
  m.assess.mockReturnValue({ hold: null });
});
it("recovers only missing source IDs in original order and original colour", async () => {
  m.read.mockResolvedValue([{ jobKey: carouselStoryKey("123", 2), status: "running" }]);
  await recoverCarouselStories(now);
  expect(m.feed).toHaveBeenCalledWith([1, 3]);
  expect(m.post).toHaveBeenCalledWith(
    expect.objectContaining({
      carouselId: "123",
      stories: [{ id: 1 }, { id: 3 }],
      variant: "light",
    })
  );
});
it.each(["success", "running", "failed"])("never replays any existing %s claim", async (status) => {
  m.read.mockResolvedValue(
    [1, 2, 3].map((id) => ({ jobKey: carouselStoryKey("123", id), status }))
  );
  await recoverCarouselStories(now);
  expect(m.post).not.toHaveBeenCalled();
});
it.each([-1, 5, 24 * 60 + 1])("ignores receipts %s minutes old", async (minutes) => {
  m.receipts.mockResolvedValue([
    { ...row, finishedAt: new Date(now.getTime() - minutes * 60_000) },
  ]);
  await recoverCarouselStories(now);
  expect(m.read).not.toHaveBeenCalled();
});
it.each([null, {}, { ...receipt, storyFollowupVersion: undefined }, { ...receipt, postId: "bad" }])(
  "ignores corrupt, untracked or invalid receipts",
  async (value) => {
    m.receipts.mockResolvedValue([{ ...row, detail: JSON.stringify(value) }]);
    await recoverCarouselStories(now);
    expect(m.post).not.toHaveBeenCalled();
  }
);
it("does not publish removed or newly held source content", async () => {
  m.feed.mockResolvedValue([{ id: 1 }]);
  m.assess.mockReturnValue({ hold: "Promotional copy" });
  await recoverCarouselStories(now);
  expect(m.post).not.toHaveBeenCalled();
});
it("stops after one carousel and fails closed on unreadable claims", async () => {
  m.receipts.mockResolvedValue([row, row]);
  await recoverCarouselStories(now);
  expect(m.post).toHaveBeenCalledOnce();
  m.post.mockClear();
  m.read.mockRejectedValue(new Error("database down"));
  await expect(recoverCarouselStories(now)).rejects.toThrow("database down");
  expect(m.post).not.toHaveBeenCalled();
});
