import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  history: vi.fn(),
  source: vi.fn(),
  read: vi.fn(),
  claim: vi.fn(),
  mark: vi.fn(),
  expire: vi.fn(),
  cooldown: vi.fn(),
  quota: vi.fn(),
  render: vi.fn(),
  story: vi.fn(),
  create: vi.fn(),
  ready: vi.fn(),
  publish: vi.fn(),
  remove: vi.fn(),
  error: vi.fn(),
}));
vi.mock("../core/env", () => ({
  env: {
    enableScheduler: true,
    scheduledApiKey: "test",
    instagramAccessToken: "test",
    instagramBusinessAccountId: "123",
  },
}));
vi.mock("../db/reelHistory", () => ({ readReelPublicationHistory: m.history }));
vi.mock("../db/reelStorySource", () => ({
  readReelStorySource: m.source,
  expireReelStoryPreparation: m.expire,
}));
vi.mock("../db/jobRuns", () => ({ readJobRun: m.read, claimJobRun: m.claim, markJobRun: m.mark }));
vi.mock("../db/health", () => ({ recordServerError: m.error }));
vi.mock("./reelStoryMeasurement", () => ({ measureReelStory: vi.fn() }));
vi.mock("./reelCandidates", () => ({ REEL_PUBLICATION_FAMILIES: { "reel-source": "supply" } }));
vi.mock("./post", () => ({ instagramCooldownActive: m.cooldown }));
vi.mock("./api", () => ({
  createVideoStoryContainer: m.create,
  fetchPublishingLimit: m.quota,
  isRateLimitError: (e: Error) => e.message.includes("rate limit"),
  publishContainer: m.publish,
  waitForContainerReady: m.ready,
}));
vi.mock("./tempStore", () => ({ storeTempImage: () => "temp", removeTempImage: m.remove }));
vi.mock("../video/statReel", () => ({ renderStatReel: m.render }));
vi.mock("../video/reelStory", () => ({ renderReelStory: m.story }));
import { runReelStoryAutomation } from "./reelStoryAutomation";
const now = new Date("2026-09-13T08:40:00Z");
const reel = {
  key: "reel-source",
  date: "2026-07-01",
  postId: "111",
  publishedAt: new Date("2026-09-13T08:35:00Z"),
};
const rows = new Map<string, any>();
beforeEach(() => {
  vi.resetAllMocks();
  rows.clear();
  m.history.mockResolvedValue([reel]);
  m.source.mockResolvedValue({
    stat: {},
    script: [{ key: "label", text: "A home." }],
    siteUrl: "https://thedesk.au",
  });
  m.read.mockImplementation(async (key: string) => rows.get(key) ?? null);
  m.claim.mockImplementation(async (key: string, _: string, max: number) => {
    const row = rows.get(key);
    if (row && (row.status !== "failed" || row.attempts >= max)) return 0;
    const attempts = (row?.attempts ?? 0) + 1;
    rows.set(key, { status: "running", attempts, startedAt: now });
    return attempts;
  });
  m.mark.mockImplementation(async (key: string, _: string, status: string, detail: string) => {
    rows.set(key, { ...rows.get(key), status, detail, finishedAt: now });
  });
  m.quota.mockResolvedValue({ usage: 1, quota: 100 });
  m.render.mockResolvedValue({ bytes: Buffer.from("reel") });
  m.story.mockResolvedValue({ bytes: Buffer.from("story"), seconds: 20 });
  m.create.mockResolvedValue("222");
  m.publish.mockResolvedValue("333");
  m.error.mockResolvedValue(undefined);
});
describe("confirmed Reel Story follow-up", () => {
  it("publishes once from the saved source and retains a separate exact media receipt", async () => {
    expect(await runReelStoryAutomation(now)).toEqual({
      state: "published",
      reelId: "111",
      storyId: "333",
    });
    expect(m.render).toHaveBeenCalledWith(
      {},
      "navy",
      expect.objectContaining({ subtitles: true, voice: { voice: "bm_fable", speed: 1 } })
    );
    expect(m.create).toHaveBeenCalledWith(
      expect.objectContaining({ videoUrl: "https://thedesk.au/instagram/temp/temp.mp4" })
    );
    expect(m.ready.mock.invocationCallOrder[0]).toBeLessThan(
      m.publish.mock.invocationCallOrder[0]!
    );
    expect(rows.get("reel-story-publish-111")).toMatchObject({
      status: "success",
      detail: "Published media 333",
      attempts: 1,
    });
    expect(m.remove).toHaveBeenCalledWith("temp");
    await runReelStoryAutomation(now);
    expect(m.publish).toHaveBeenCalledTimes(1);
    expect(m.claim.mock.calls.every(([key]) => key.startsWith("reel-story-"))).toBe(true);
  });
  it("does not enrol old posts, publish without a confirmed Reel, or ignore cooldown", async () => {
    m.history.mockResolvedValue([]);
    expect((await runReelStoryAutomation(now)).state).toBe("no-confirmed-reel");
    m.history.mockResolvedValue([reel]);
    m.source.mockResolvedValue(null);
    expect((await runReelStoryAutomation(now)).state).toBe("not-enrolled");
    expect((await runReelStoryAutomation(new Date("2026-09-14T08:40:00Z"))).state).toBe(
      "outside-followup-window"
    );
    m.cooldown.mockReturnValue(true);
    expect((await runReelStoryAutomation(now)).state).toBe("cooldown");
    expect(m.publish).not.toHaveBeenCalled();
    expect(m.render).not.toHaveBeenCalled();
  });
  it("keeps uncertain publication locked across later ticks and restarts", async () => {
    m.publish.mockRejectedValue(new Error("network timeout"));
    expect((await runReelStoryAutomation(now)).state).toBe("paused");
    expect(rows.get("reel-story-publish-111")).toMatchObject({
      status: "failed",
      attempts: 1,
      detail: expect.stringContaining("222"),
    });
    expect((await runReelStoryAutomation(new Date("2026-09-13T09:00:00Z"))).state).toBe("locked");
    expect(m.publish).toHaveBeenCalledTimes(1);
    expect(m.expire).not.toHaveBeenCalled();
  });
  it("bounds preparation retries and lets another replica recover saved work", async () => {
    m.render.mockRejectedValueOnce(new Error("renderer busy"));
    expect((await runReelStoryAutomation(now)).state).toBe("retrying");
    expect((await runReelStoryAutomation(now)).state).toBe("waiting");
    expect(rows.has("reel-story-publish-111")).toBe(false);
    expect((await runReelStoryAutomation(new Date("2026-09-13T08:56:00Z"))).state).toBe(
      "published"
    );
    expect(m.publish).toHaveBeenCalledTimes(1);
  });
  it("does not claim publication when quota, readiness or durable reads fail", async () => {
    m.quota.mockResolvedValue({ usage: null, quota: null });
    expect((await runReelStoryAutomation(now)).state).toBe("retrying");
    expect(m.render).not.toHaveBeenCalled();
    expect(rows.has("reel-story-publish-111")).toBe(false);
    rows.clear();
    m.quota.mockResolvedValue({ usage: 1, quota: 100 });
    m.ready.mockRejectedValue(new Error("processing unavailable"));
    expect((await runReelStoryAutomation(now)).state).toBe("retrying");
    expect(m.publish).not.toHaveBeenCalled();
    expect(m.remove).toHaveBeenCalledWith("temp");
    m.read.mockRejectedValue(new Error("DB unavailable"));
    await expect(runReelStoryAutomation(now)).rejects.toThrow("DB unavailable");
    expect(m.publish).not.toHaveBeenCalled();
  });
  it("pauses immediately on integrity/rate limits", async () => {
    m.create.mockRejectedValue(new Error("rate limit"));
    expect((await runReelStoryAutomation(now)).state).toBe("paused");
    expect((await runReelStoryAutomation(new Date("2026-09-13T08:56:00Z"))).state).toBe("paused");
    expect(m.create).toHaveBeenCalledTimes(1);
    expect(m.publish).not.toHaveBeenCalled();
  });
  it("allows only one preparer when replicas race", async () => {
    await Promise.all([runReelStoryAutomation(now), runReelStoryAutomation(now)]);
    expect(m.render).toHaveBeenCalledTimes(1);
    expect(m.publish).toHaveBeenCalledTimes(1);
  });
  it("does not report success if Meta confirms but receipt persistence fails", async () => {
    m.mark.mockImplementation(async () => {});
    expect((await runReelStoryAutomation(now)).state).toBe("paused");
    expect(rows.get("reel-story-publish-111").status).toBe("running");
    expect((await runReelStoryAutomation(now)).state).toBe("locked");
    expect(m.publish).toHaveBeenCalledTimes(1);
  });
});
