import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ read: vi.fn(), claim: vi.fn(), mark: vi.fn(), reach: vi.fn() }));
vi.mock("../db/jobRuns", () => ({ readJobRun: m.read, claimJobRun: m.claim, markJobRun: m.mark }));
vi.mock("./api", () => ({ fetchStoryReach: m.reach }));
import { measureReelStory } from "./reelStoryMeasurement";
const opts = {
  reelId: "111",
  storyId: "333",
  date: "2026-07-01",
  publishedAt: new Date("2026-09-13T08:40:00Z"),
  now: new Date("2026-09-13T09:10:00Z"),
  accessToken: "test",
};
beforeEach(() => {
  vi.resetAllMocks();
  m.read.mockResolvedValue(null);
  m.claim.mockResolvedValue(1);
});
it("records a genuine zero separately from unavailable Story reach at the actual observed age", async () => {
  m.reach.mockResolvedValue(0);
  await measureReelStory(opts);
  expect(m.reach).toHaveBeenCalledWith({ mediaId: "333", accessToken: "test" });
  expect(m.mark).toHaveBeenLastCalledWith(
    "reel-story-reach-333",
    opts.date,
    "success",
    expect.any(String)
  );
  expect(JSON.parse(m.mark.mock.calls[0]![3])).toMatchObject({
    reelId: "111",
    storyId: "333",
    reach: 0,
    ageMinutes: 30,
  });
  m.reach.mockRejectedValue(new Error("unavailable"));
  await measureReelStory(opts);
  expect(JSON.parse(m.mark.mock.calls[1]![3])).toMatchObject({
    reach: null,
    status: "unavailable",
  });
});
it("does not query before thirty minutes, after expiry, or after a saved snapshot", async () => {
  await measureReelStory({ ...opts, now: opts.publishedAt });
  await measureReelStory({ ...opts, now: new Date("2026-09-14T09:10:00Z") });
  m.read.mockResolvedValue({ status: "success" });
  await measureReelStory(opts);
  expect(m.reach).not.toHaveBeenCalled();
});
