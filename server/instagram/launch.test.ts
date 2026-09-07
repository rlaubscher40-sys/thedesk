import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../core/context";

const mocks = vi.hoisted(() => ({
  rows: vi.fn(),
  claim: vi.fn(),
  mark: vi.fn(),
  record: vi.fn(),
  render: vi.fn(),
  image: vi.fn(),
  carousel: vi.fn(),
  ready: vi.fn(),
  publish: vi.fn(),
  quota: vi.fn(),
  store: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../core/env", () => ({
  env: { instagramAccessToken: "test-token", instagramBusinessAccountId: "test-account" },
}));
vi.mock("../db/client", () => ({
  getDb: () => ({ select: () => ({ from: () => ({ where: mocks.rows }) }) }),
}));
vi.mock("../db/jobRuns", () => ({ claimJobRun: mocks.claim, markJobRun: mocks.mark }));
vi.mock("../db/instagramPosts", () => ({
  recordInstagramPost: mocks.record,
  listInstagramPosts: vi.fn(),
}));
vi.mock("../og/instagramCards", () => ({ renderLaunchSlide: mocks.render }));
vi.mock("./tempStore", () => ({ storeTempImage: mocks.store, removeTempImage: mocks.remove }));
vi.mock("./api", () => ({
  createImageContainer: mocks.image,
  createCarouselContainer: mocks.carousel,
  waitForContainerReady: mocks.ready,
  publishContainer: mocks.publish,
  fetchPublishingLimit: mocks.quota,
  isTransientServerError: vi.fn(),
}));

import { publishLaunchPost, LAUNCH_DATE } from "./launch";
import { buildLaunchContent, launchContentHash } from "./launchContent";
import { instagramRouter } from "../routers/instagram";
const hash = launchContentHash(buildLaunchContent("start"));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rows.mockResolvedValue([]);
  mocks.claim.mockResolvedValue(1);
  mocks.render.mockResolvedValue(Buffer.from("jpeg"));
  mocks.store.mockReturnValue("temporary-id");
  mocks.image.mockResolvedValue("child");
  mocks.carousel.mockResolvedValue("parent");
  mocks.ready.mockResolvedValue(undefined);
  mocks.publish.mockResolvedValue("published-id");
  mocks.quota.mockResolvedValue({ usage: 3, quota: 50 });
});

describe("one-time Meta launch publication", () => {
  it("waits for children and parent, claims durably, publishes once and records for insights", async () => {
    expect(await publishLaunchPost("start", hash)).toMatchObject({ postId: "published-id" });
    expect(mocks.image).toHaveBeenCalledTimes(5);
    expect(mocks.ready).toHaveBeenCalledTimes(6);
    expect(mocks.carousel).toHaveBeenCalledWith(
      expect.objectContaining({
        childrenIds: Array(5).fill("child"),
        caption: buildLaunchContent("start").caption,
      })
    );
    expect(mocks.claim).toHaveBeenCalledWith("instagram-launch-v1-start", LAUNCH_DATE, 1);
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({ creationId: "parent" }));
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({ mediaId: "published-id", postType: "launch" })
    );
    expect(mocks.remove).toHaveBeenCalledTimes(5);
  });
  it("rejects an unreviewed or changed payload before contacting Meta", async () => {
    await expect(publishLaunchPost("start", "0".repeat(64))).rejects.toThrow("changed");
    expect(mocks.quota).not.toHaveBeenCalled();
  });
  it("fails closed if durable records cannot be read or the slot already exists", async () => {
    mocks.rows.mockRejectedValueOnce(new Error("offline"));
    await expect(publishLaunchPost("start", hash)).rejects.toThrow("locked");
    mocks.rows.mockResolvedValueOnce([{ jobKey: "instagram-launch-v1-start", status: "success" }]);
    await expect(publishLaunchPost("start", hash)).rejects.toThrow("locked");
    expect(mocks.image).not.toHaveBeenCalled();
  });
  it.each([
    { usage: null, quota: 50 },
    { usage: 50, quota: 50 },
  ])("does not post with unavailable or exhausted quota: %j", async (quota) => {
    mocks.quota.mockResolvedValue(quota);
    await expect(publishLaunchPost("start", hash)).rejects.toThrow("quota");
    expect(mocks.image).not.toHaveBeenCalled();
  });
  it("does not reserve a slot when image processing fails, and cleans its temporary file", async () => {
    mocks.ready.mockRejectedValueOnce(new Error("processing failed"));
    await expect(publishLaunchPost("start", hash)).rejects.toThrow("processing failed");
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });
  it("only lets the atomic claim winner publish under concurrent requests", async () => {
    mocks.claim.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const results = await Promise.allSettled([
      publishLaunchPost("start", hash),
      publishLaunchPost("start", hash),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(mocks.publish).toHaveBeenCalledTimes(1);
  });
  it("never retries an uncertain publish or records a guessed success", async () => {
    mocks.publish.mockRejectedValue(new Error("response lost"));
    await expect(publishLaunchPost("start", hash)).rejects.toThrow("locked");
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mocks.mark).toHaveBeenCalledWith(
      "instagram-launch-v1-start",
      LAUNCH_DATE,
      "failed",
      expect.stringContaining("parent")
    );
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledTimes(5);
  });
  it("requires admin access for preview and publication and rejects arbitrary content", async () => {
    const context = { req: {}, res: {}, user: null } as TrpcContext;
    const caller = instagramRouter.createCaller(context);
    await expect(caller.launchPreview({ id: "start" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller.launchPublish({ id: "start", contentHash: hash })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const admin = instagramRouter.createCaller({
      ...context,
      user: { role: "admin" } as NonNullable<TrpcContext["user"]>,
    });
    await expect(
      admin.launchPublish({ id: "start", contentHash: hash, caption: "arbitrary" } as never)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.publish).not.toHaveBeenCalled();
  });
});
