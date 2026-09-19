import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { savedReelReviewSchema, type ReelReviewSave } from "../../shared/reelReview";
import { getDb } from "./client";
import { isDemoMode } from "../demo/store";
import { jobRuns } from "./schema";
import { readJobRun } from "./jobRuns";
import { readReelRenderAudit } from "../instagram/reelRenderAudit";

type Identity = Pick<ReelReviewSave, "publication" | "postId" | "videoSha256">;
function reviewKey(identity: Identity) {
  return `reel-human-review-${createHash("sha256")
    .update(
      JSON.stringify([
        identity.publication.key,
        identity.publication.date,
        identity.postId,
        identity.videoSha256,
      ])
    )
    .digest("hex")
    .slice(0, 40)}`;
}

export async function readReelReview(identity: Identity) {
  const row = await readJobRun(reviewKey(identity), identity.publication.date);
  if (!row) return null;
  const saved = savedReelReviewSchema.parse(JSON.parse(row.detail ?? "null"));
  if (
    row.status !== "success" ||
    row.attempts !== saved.review.version ||
    reviewKey(saved.review) !== reviewKey(identity)
  )
    throw new Error("The saved human review is invalid.");
  return saved;
}

/** Separate namespace and optimistic revision. Never writes a publication lock,
 * approval, release date or an existing MP4. The admin supplies the attestation. */
export async function saveReelReview(input: ReelReviewSave, reviewerId: number) {
  const db = getDb();
  if (!db || isDemoMode()) throw new Error("Human review storage unavailable.");
  const audit = await readReelRenderAudit(input.publication);
  if (
    audit.state !== "recorded" ||
    audit.postId !== input.postId ||
    audit.render.videoSha256 !== input.videoSha256
  )
    throw new TRPCError({
      code: "CONFLICT",
      message: "The exact submitted export could not be verified. Refresh before reviewing.",
    });
  const saved = savedReelReviewSchema.parse({
    review: { ...input, version: input.version + 1 },
    reviewerId,
    reviewedAt: new Date().toISOString(),
  });
  const values = {
    jobKey: reviewKey(input),
    runDate: input.publication.date,
    status: "success",
    attempts: saved.review.version,
    detail: JSON.stringify(saved),
    finishedAt: new Date(),
  };
  const result =
    input.version === 0
      ? await db.insert(jobRuns).ignore().values(values)
      : await db
          .update(jobRuns)
          .set(values)
          .where(
            and(
              eq(jobRuns.jobKey, values.jobKey),
              eq(jobRuns.runDate, values.runDate),
              eq(jobRuns.attempts, input.version)
            )
          );
  if (result[0].affectedRows !== 1)
    throw new TRPCError({
      code: "CONFLICT",
      message: "This review changed in another tab. Reload before saving.",
    });
  return saved;
}
