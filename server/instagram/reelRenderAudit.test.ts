import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const m = vi.hoisted(() => ({ receipt: vi.fn(), source: vi.fn() }));
vi.mock("./reelStatus", () => ({ reelPublicationRecord: m.receipt }));
vi.mock("../db/reelStorySource", () => ({ readReelStorySource: m.source }));
import { readReelRenderAudit } from "./reelRenderAudit";
import { captureReelRender, reelRenderRecordSchema } from "../video/reelRenderRecord";

const publication = { key: "instagram-reel-example", date: "2026-07-01" };
const video = {
  bytes: Buffer.from("the actual encoded export"),
  seconds: 31.5,
  narrated: true,
  subtitled: true,
};
const cover = Buffer.from("the actual encoded cover");
const stat = { label: "Test", value: "1", line: "Evidence", subtext: "Period" };
const capture = () =>
  captureReelRender(video, cover, stat, { voice: "bm_fable", speed: 1 }, "a".repeat(40));
beforeEach(() => {
  vi.resetAllMocks();
  m.receipt.mockResolvedValue({ state: "published", postId: "123" });
  m.source.mockResolvedValue({ render: capture() });
});

describe("durable Reel export provenance", () => {
  it("fingerprints actual video and cover bytes and snapshots the supplied voice", () => {
    const voice = { voice: "bm_fable", speed: 1 };
    const record = captureReelRender(video, cover, stat, voice, "bad-build-value");
    voice.speed = 2;
    expect(record.videoSha256).toBe(createHash("sha256").update(video.bytes).digest("hex"));
    expect(record.coverSha256).toBe(createHash("sha256").update(cover).digest("hex"));
    expect(record.voice.speed).toBe(1);
    expect(record.buildCommit).toBeNull();
    expect(record.recipe).toBeNull();
    expect(record.safeAreas.attributionTop - record.safeAreas.sceneBottom).toBe(40);
    expect(
      captureReelRender({ ...video, bytes: Buffer.from("different export") }, cover, stat, voice)
        .videoSha256
    ).not.toBe(record.videoSha256);
  });
  it("joins the saved export to the exact durable confirmed publication", async () => {
    expect(await readReelRenderAudit(publication)).toEqual({
      state: "recorded",
      postId: "123",
      render: capture(),
    });
    expect(m.receipt).toHaveBeenCalledWith(publication);
    expect(m.source).toHaveBeenCalledWith(publication);
  });
  it.each(["available", "locked"])(
    "never presents staged data as published for a %s receipt",
    async (state) => {
      m.receipt.mockResolvedValue({ state, postId: null });
      expect(await readReelRenderAudit(publication)).toEqual({
        state: "unconfirmed",
        postId: null,
        render: null,
      });
      expect(m.source).not.toHaveBeenCalled();
    }
  );
  it("keeps old or absent provenance unknown instead of assigning current defaults", async () => {
    for (const source of [null, { version: 1, stat, script: [], siteUrl: "https://thedesk.au" }]) {
      m.source.mockResolvedValue(source);
      expect(await readReelRenderAudit(publication)).toEqual({
        state: "not-recorded",
        postId: "123",
        render: null,
      });
    }
  });
  it("treats malformed records and storage failures as unavailable, never unpublished", async () => {
    for (const render of [
      { ...capture(), videoSha256: "broken" },
      { ...capture(), version: 2 },
      { ...capture(), seconds: -1 },
    ]) {
      m.source.mockResolvedValue({ render });
      expect(await readReelRenderAudit(publication)).toEqual({
        state: "unavailable",
        postId: "123",
        render: null,
      });
    }
    m.source.mockRejectedValue(new Error("Database unavailable"));
    expect(await readReelRenderAudit(publication)).toMatchObject({
      state: "unavailable",
      postId: "123",
    });
    m.receipt.mockResolvedValue({ state: "unavailable", postId: null });
    expect(await readReelRenderAudit(publication)).toEqual({
      state: "unavailable",
      postId: null,
      render: null,
    });
  });
  it("reads recorded old spacing honestly rather than replacing it with current bounds", () => {
    const old = {
      ...capture(),
      safeAreas: { ...capture().safeAreas, sceneBottom: 1320, subtitleTop: 1490 },
    };
    expect(reelRenderRecordSchema.parse(old).safeAreas).toEqual(old.safeAreas);
  });
});
