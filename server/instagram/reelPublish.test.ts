import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  quota: vi.fn(),
  render: vi.fn(),
  cover: vi.fn(),
  create: vi.fn(),
  ready: vi.fn(),
  publish: vi.fn(),
  claim: vi.fn(),
  mark: vi.fn(),
  store: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../core/env", () => ({
  env: { instagramAccessToken: "test", instagramBusinessAccountId: "test" },
}));
vi.mock("../video/statReel", () => ({ renderStatReel: m.render }));
vi.mock("../og/instagramCards", () => ({ renderStatCard: m.cover }));
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
  m.quota.mockResolvedValue({ usage: 1, quota: 100 });
  m.render.mockResolvedValue({ bytes: Buffer.from("video"), seconds: 25, narrated: true });
  m.cover.mockResolvedValue(Buffer.from("cover"));
  m.store.mockReturnValue("temp");
  m.create.mockResolvedValue("container");
  m.claim.mockResolvedValue(1);
  m.publish.mockResolvedValue("media");
});
describe("narrated Reel publication", () => {
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
