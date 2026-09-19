import { expect, it } from "vitest";
import { reelReviewOutcome, reelReviewSaveSchema, type ReelReviewSave } from "./reelReview";
export const pendingReview: ReelReviewSave = {
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
};
it("never turns technical checks or unfinished human review into approval", () => {
  expect(reelReviewOutcome(pendingReview)).toBe("Review incomplete");
  expect(
    reelReviewSaveSchema.safeParse({
      ...pendingReview,
      checks: { ...pendingReview.checks, voice: "pass" },
    }).success
  ).toBe(false);
  expect(reelReviewOutcome({ ...pendingReview, watchedAndListened: true })).toBe(
    "Review incomplete"
  );
});
it("requires correction notes and rejects forged identity/extra fields", () => {
  expect(
    reelReviewSaveSchema.safeParse({
      ...pendingReview,
      checks: { ...pendingReview.checks, hook: "fix" },
    }).success
  ).toBe(false);
  expect(reelReviewSaveSchema.safeParse({ ...pendingReview, reviewerId: 7 }).success).toBe(false);
  expect(
    reelReviewSaveSchema.safeParse({
      ...pendingReview,
      publication: { ...pendingReview.publication, date: "2026-02-31" },
    }).success
  ).toBe(false);
});
