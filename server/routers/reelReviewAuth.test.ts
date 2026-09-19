import { expect, it, vi } from "vitest";
vi.mock("../db/reelReviews", () => ({ saveReelReview: vi.fn(async () => ({})) }));
vi.mock("../instagram/reelOperations", () => ({ readReelOperations: vi.fn(async () => ({})) }));
import { saveReelReview } from "../db/reelReviews";
import { readReelOperations } from "../instagram/reelOperations";
import { instagramRouter } from "./instagram";
import type { TrpcContext } from "../core/context";
const input = {
  publication: { key: "instagram-reel-example", date: "2026-09-01" },
  postId: "123",
  videoSha256: "a".repeat(64),
  version: 0,
  watchedAndListened: false,
  checks: {
    hook: "pending",
    progression: "pending",
    evidence: "pending",
    pictures: "pending",
    voice: "pending",
    sync: "pending",
  },
  notes: "",
  nextTest: "",
} as const;
it.each([null, { id: 1, role: "user" }])(
  "blocks unauthorized reads and writes before storage",
  async (user) => {
    vi.clearAllMocks();
    const caller = instagramRouter.createCaller({ user, req: {}, res: {} } as TrpcContext);
    await expect(caller.reelOperations()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.saveReelReview(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(saveReelReview).not.toHaveBeenCalled();
    expect(readReelOperations).not.toHaveBeenCalled();
  }
);
it("takes reviewer identity from the authenticated admin and validates attestation", async () => {
  vi.clearAllMocks();
  const caller = instagramRouter.createCaller({
    user: { id: 7, role: "admin" },
    req: {},
    res: {},
  } as TrpcContext);
  await caller.saveReelReview(input);
  expect(saveReelReview).toHaveBeenCalledWith(input, 7);
  await expect(
    caller.saveReelReview({ ...input, checks: { ...input.checks, voice: "pass" } })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
