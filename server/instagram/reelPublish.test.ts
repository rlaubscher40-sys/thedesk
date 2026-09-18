import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const m = vi.hoisted(() => ({
  quota: vi.fn(),
  archive: vi.fn(),
  guard: vi.fn(),
  render: vi.fn(),
  cover: vi.fn(),
  create: vi.fn(),
  ready: vi.fn(),
  publish: vi.fn(),
  claim: vi.fn(),
  mark: vi.fn(),
  store: vi.fn(),
  remove: vi.fn(),
  stage: vi.fn(),
}));
vi.mock("./documentaryExports", () => ({ approvedDocumentaryExport: m.archive }));
vi.mock("./documentaryPublicationGuard", () => ({ documentaryPublicationGuard: m.guard }));
vi.mock("../db/reelStorySource", () => ({ stageReelStorySource: m.stage }));
vi.mock("../core/env", () => ({
  env: { instagramAccessToken: "test", instagramBusinessAccountId: "test" },
}));
vi.mock("../video/statReel", () => ({ renderStatReel: m.render }));
vi.mock("../video/reelCover", () => ({ renderReelCover: m.cover }));
vi.mock("../db/jobRuns", () => ({ claimJobRun: m.claim, markJobRun: m.mark }));
vi.mock("./tempStore", () => ({ storeTempImage: m.store, removeTempImage: m.remove }));
vi.mock("./api", () => ({
  fetchPublishingLimit: m.quota,
  createReelContainer: m.create,
  waitForContainerReady: m.ready,
  publishContainer: m.publish,
}));
import { postStatReel } from "./post";
const stat = {
  label: "Brisbane vs Perth rents",
  value: "0.7pp",
  line: "Perth's annual rent growth is higher.",
  subtext: "Year to July 2026",
};
const options = {
  publication: { key: "reel-test", date: "2026-07-01" },
  caption: "Verified sourced caption",
};
beforeEach(() => {
  vi.resetAllMocks();
  m.guard.mockResolvedValue({ ready: true });
  m.archive.mockResolvedValue({
    bytes: Buffer.from("approved-mp4"),
    seconds: 84.6,
    narrated: true,
    subtitled: true,
  });
  m.quota.mockResolvedValue({ usage: 1, quota: 100 });
  m.render.mockResolvedValue({
    bytes: Buffer.from("video"),
    seconds: 25,
    narrated: true,
    subtitled: true,
  });
  m.cover.mockResolvedValue(Buffer.from("cover"));
  m.store.mockReturnValue("temp");
  m.create.mockResolvedValue("container");
  m.claim.mockResolvedValue(1);
  m.publish.mockResolvedValue("media");
});
describe("narrated Reel publication", () => {
  it("rejects invalid captions before quota requests, rendering or publication", async () => {
    await expect(
      postStatReel(stat, "https://thedesk.au", { ...options, caption: "x".repeat(2201) })
    ).rejects.toThrow("no factual truncation");
    expect(m.quota).not.toHaveBeenCalled();
    expect(m.render).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
    expect(m.publish).not.toHaveBeenCalled();
  });
  it("saves the Story source only after winning the Reel claim and before publication", async () => {
    const script = [{ key: "label", text: "A home." }];
    await postStatReel(stat, "https://thedesk.au", { ...options, script });
    expect(m.cover).toHaveBeenCalledWith(stat, script);
    expect(m.create).toHaveBeenCalledWith(
      expect.objectContaining({ coverUrl: "https://thedesk.au/instagram/temp/temp.jpg" })
    );
    expect(m.claim.mock.invocationCallOrder[0]).toBeLessThan(m.stage.mock.invocationCallOrder[0]!);
    expect(m.stage.mock.invocationCallOrder[0]).toBeLessThan(
      m.publish.mock.invocationCallOrder[0]!
    );
    expect(m.stage).toHaveBeenCalledWith(
      options.publication,
      expect.objectContaining({
        script,
        siteUrl: "https://thedesk.au",
        render: expect.objectContaining({
          videoSha256: createHash("sha256").update("video").digest("hex"),
          coverSha256: createHash("sha256").update("cover").digest("hex"),
          seconds: 25,
          narrated: true,
          subtitled: true,
          voice: { engine: "local-kokoro", voice: "bm_fable", speed: 1 },
        }),
      })
    );
    m.stage.mockClear();
    m.claim.mockResolvedValue(0);
    await expect(postStatReel(stat, "https://thedesk.au", { ...options, script })).rejects.toThrow(
      "locked"
    );
    expect(m.stage).not.toHaveBeenCalled();
  });
  it("keeps the Reel successful if the companion source cannot be saved", async () => {
    m.stage.mockRejectedValue(new Error("Story storage unavailable"));
    await expect(
      postStatReel(stat, "https://thedesk.au", {
        ...options,
        script: [{ key: "label", text: "A home." }],
      })
    ).resolves.toMatchObject({ postId: "media" });
    expect(m.publish).toHaveBeenCalledTimes(1);
  });
  it("requires quota and a durable slot before one publish, then records success", async () => {
    expect(await postStatReel(stat, "https://thedesk.au", options)).toMatchObject({
      postId: "media",
    });
    expect(m.claim).toHaveBeenCalledWith("reel-test", "2026-07-01", 1);
    expect(m.publish).toHaveBeenCalledTimes(1);
    expect(m.ready.mock.invocationCallOrder[0]).toBeLessThan(m.claim.mock.invocationCallOrder[0]!);
    expect(m.claim.mock.invocationCallOrder[0]).toBeLessThan(
      m.publish.mock.invocationCallOrder[0]!
    );
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ caption: options.caption }));
    expect(m.mark).toHaveBeenCalledWith(
      "reel-test",
      "2026-07-01",
      "success",
      "Published media media"
    );
  });
  it("refuses a silent render before creating a Meta container", async () => {
    m.render.mockResolvedValue({ bytes: Buffer.from("silent"), seconds: 25, narrated: false });
    await expect(postStatReel(stat, "https://thedesk.au", options)).rejects.toThrow("silent");
    expect(m.create).not.toHaveBeenCalled();
  });
  it("withholds publication if its photographic cover cannot be rendered", async () => {
    m.cover.mockRejectedValue(new Error("Reviewed Reel cover photograph is missing"));
    await expect(postStatReel(stat, "https://thedesk.au", options)).rejects.toThrow(
      "photograph is missing"
    );
    expect(m.create).not.toHaveBeenCalled();
    expect(m.claim).not.toHaveBeenCalled();
    expect(m.publish).not.toHaveBeenCalled();
  });
  it("preserves the evidence storyboard through the publishing wrapper", async () => {
    const storyboard = { kind: "approvals-comparison", scenes: [] };
    const candidate = { ...stat, storyboard };
    await postStatReel(candidate, "https://thedesk.au", options);
    expect(m.render).toHaveBeenCalledWith(
      expect.objectContaining({ storyboard }),
      "navy",
      expect.any(Object)
    );
  });
  it("requires subtitles even when a caller omits or disables them", async () => {
    m.render.mockResolvedValue({ bytes: Buffer.from("uncaptioned"), seconds: 25, narrated: true });
    await expect(
      postStatReel(stat, "https://thedesk.au", { ...options, subtitles: false })
    ).rejects.toThrow("subtitles");
    expect(m.create).not.toHaveBeenCalled();
    m.render.mockResolvedValue({
      bytes: Buffer.from("captioned"),
      seconds: 25,
      narrated: true,
      subtitled: true,
    });
    await expect(
      postStatReel(stat, "https://thedesk.au", { ...options, subtitles: true })
    ).resolves.toMatchObject({ postId: "media" });
    expect(m.render).toHaveBeenLastCalledWith(
      expect.any(Object),
      "navy",
      expect.objectContaining({
        subtitles: true,
        narrate: true,
        voice: { voice: "bm_fable", speed: 1 },
      })
    );
  });
  it("refuses unavailable quota, missing identity and a lost reservation", async () => {
    await expect(postStatReel(stat, "https://thedesk.au")).rejects.toThrow("reservation");
    m.quota.mockResolvedValueOnce({ usage: null, quota: 100 });
    await expect(postStatReel(stat, "https://thedesk.au", options)).rejects.toThrow("quota");
    expect(m.render).not.toHaveBeenCalled();
    m.claim.mockResolvedValue(0);
    await expect(postStatReel(stat, "https://thedesk.au", options)).rejects.toThrow("locked");
    expect(m.publish).not.toHaveBeenCalled();
  });
  it("locks an uncertain publish without issuing a second publish", async () => {
    m.publish.mockRejectedValue(new Error("socket closed"));
    await expect(postStatReel(stat, "https://thedesk.au", options)).rejects.toThrow(
      "slot is locked"
    );
    expect(m.publish).toHaveBeenCalledTimes(1);
    expect(m.mark).toHaveBeenCalledWith(
      "reel-test",
      "2026-07-01",
      "failed",
      expect.stringContaining("container")
    );
    expect(m.remove).toHaveBeenCalledTimes(2);
  });
});

it("posts saved documentary bytes and rejects cross-programme export identities", async () => {
  const { DOCUMENTARY_EPISODES } = await import("./documentaryEpisodes");
  const { documentaryCandidate } = await import("./verifiedDocumentaryReel");
  const candidate = documentaryCandidate(DOCUMENTARY_EPISODES[0]!);
  await postStatReel(candidate.stat, "https://thedesk.au", { ...candidate });
  expect(m.archive).toHaveBeenCalledOnce();
  expect(m.render).not.toHaveBeenCalled();
  expect(m.store).toHaveBeenCalledWith(Buffer.from("approved-mp4"), "video/mp4");
  m.publish.mockClear();
  await expect(postStatReel(candidate.stat, "https://thedesk.au", options)).rejects.toThrow(
    "another programme"
  );
  expect(m.publish).not.toHaveBeenCalled();
  m.guard.mockResolvedValue({ ready: false, reason: "duplicate" });
  await expect(
    postStatReel(candidate.stat, "https://thedesk.au", { ...candidate })
  ).rejects.toThrow("duplicate");
  expect(m.publish).not.toHaveBeenCalled();
});
