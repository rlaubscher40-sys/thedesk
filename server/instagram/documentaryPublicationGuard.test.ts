import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ history: vi.fn(), source: vi.fn(), receipt: vi.fn() }));
vi.mock("../db/documentaryHistory", () => ({ readDocumentaryComparisonHistory: m.history }));
vi.mock("../db/reelStorySource", () => ({ readReelStorySource: m.source }));
vi.mock("./reelStatus", () => ({ reelPublicationRecord: m.receipt }));
import { documentaryPublicationGuard } from "./documentaryPublicationGuard";
import { DOCUMENTARY_REVIEWS, DOCUMENTARY_RELEASE_AUTHORISATION } from "./documentaryReviews";
import { DOCUMENTARY_EPISODES } from "./documentaryEpisodes";
import { documentaryCandidate, documentaryLaunchReady } from "./verifiedDocumentaryReel";
import { approvedDocumentaryExport } from "./documentaryExports";
const now = new Date("2026-09-17T06:00:00Z");
beforeEach(() => {
  vi.resetAllMocks();
  m.history.mockResolvedValue([]);
  m.source.mockResolvedValue(null);
  m.receipt.mockResolvedValue({ state: "available" });
});
describe("documentary release controls", () => {
  it("loads the exact four approved MP4s while honestly recording the absent listening review", async () => {
    expect(documentaryLaunchReady()).toBe(true);
    expect(DOCUMENTARY_RELEASE_AUTHORISATION.fullListening).toBe("not-performed");
    for (const episode of DOCUMENTARY_EPISODES) {
      const story = documentaryCandidate(episode).stat.documentary!;
      const video = await approvedDocumentaryExport(story);
      // Duration and compression change with the speaker. Container identity,
      // the complete digest and recorded narrator bind the actual export.
      expect(video.bytes.subarray(4, 8).toString("ascii")).toBe("ftyp");
      expect(video.seconds).toBe(DOCUMENTARY_REVIEWS[episode.id]!.seconds);
      expect(video.voice).toEqual(DOCUMENTARY_REVIEWS[episode.id]!.voice);
      expect(video.voice).toEqual({
        engine: "elevenlabs",
        voice: "xeSYpoWjkR3imzxB6qDk",
        speed: 1,
      });
      expect(video.spokenBy).toBe(video.voice.engine);
      const changed = structuredClone(story);
      changed.scenes[0]!.phrases[0] += " Changed.";
      await expect(approvedDocumentaryExport(changed)).rejects.toThrow("render inputs");
    }
  });
  it("compares all upcoming ordinary recipes and recent published stories", async () => {
    m.history.mockResolvedValue([
      { key: "instagram-reel-abs-melbourne-before-buy-v1", date: "2026-07-01", postId: "123" },
    ]);
    expect(await documentaryPublicationGuard("triguboff-apartments", now)).toMatchObject({
      ready: true,
      comparedReceipts: 1,
      comparedUpcoming: 18,
    });
  });
  it("holds a different title about the same family without a sourced distinction", async () => {
    m.history.mockResolvedValue([
      { key: "instagram-reel-documentary-grollo-ownership-v1", date: "2026-09-14", postId: "123" },
    ]);
    expect(await documentaryPublicationGuard("grollo-family", now)).toMatchObject({
      ready: false,
      reason: expect.stringContaining("overlaps"),
    });
  });
  it("holds unknown history, unavailable history and reused export bytes", async () => {
    m.history.mockResolvedValue([
      { key: "instagram-reel-new-story", date: "2026-09-01", postId: "123" },
    ]);
    expect(await documentaryPublicationGuard("lowy-westfield", now)).toMatchObject({
      ready: false,
      reason: expect.stringContaining("Unclassified"),
    });
    m.history.mockRejectedValue(new Error("history unavailable"));
    expect(await documentaryPublicationGuard("lowy-westfield", now)).toMatchObject({
      ready: false,
    });
    m.history.mockResolvedValue([
      { key: "instagram-reel-abs-melbourne-before-buy-v1", date: "2026-07-01", postId: "123" },
    ]);
    m.source.mockResolvedValue({
      stat: {},
      render: { videoSha256: DOCUMENTARY_REVIEWS["lowy-westfield"]!.videoSha256 },
    });
    expect(await documentaryPublicationGuard("lowy-westfield", now)).toMatchObject({
      ready: false,
      reason: expect.stringContaining("same export"),
    });
  });
  it.each(["locked", "unavailable"])(
    "retains %s permanent receipts, including retired episodes",
    async (state) => {
      m.receipt.mockImplementation(async ({ key }) => ({
        state: key.includes("grollo-ownership") ? state : "available",
      }));
      expect(await documentaryPublicationGuard("lowy-westfield", now)).toMatchObject({
        ready: false,
        reason: expect.stringContaining(state),
      });
    }
  );
});
