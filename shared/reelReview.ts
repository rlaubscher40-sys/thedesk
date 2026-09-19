import { z } from "zod";

export const REEL_REVIEW_CHECKS = {
  hook: "The opening makes the story and its stakes clear.",
  progression: "Each section adds something; the story progresses to a useful takeaway.",
  evidence: "Claims, figures, qualifications and source credits match the source material.",
  pictures: "Pictures explain the story, vary meaningfully and remain readable on a phone.",
  voice: "The full read sounds natural; names, numbers, emphasis and pauses are clear.",
  sync: "Captions, scene changes and music support the narration throughout.",
} as const;

const reelReviewIdentitySchema = z
  .object({
    publication: z
      .object({
        key: z
          .string()
          .regex(/^instagram-reel-[a-z0-9-]+$/)
          .max(64),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .refine((value) => {
            const date = new Date(`${value}T00:00:00Z`);
            return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
          }),
      })
      .strict(),
    postId: z.string().regex(/^\d+$/).max(40),
    videoSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const check = z.enum(["pending", "pass", "fix"]);
export const reelReviewSaveSchema = reelReviewIdentitySchema
  .extend({
    version: z.number().int().min(0).max(100000),
    watchedAndListened: z.boolean(),
    checks: z
      .object({
        hook: check,
        progression: check,
        evidence: check,
        pictures: check,
        voice: check,
        sync: check,
      })
      .strict(),
    notes: z.string().trim().max(4000),
    nextTest: z.string().trim().max(1500),
  })
  .strict()
  .superRefine((review, ctx) => {
    if (!review.watchedAndListened && Object.values(review.checks).includes("pass"))
      ctx.addIssue({
        code: "custom",
        message: "Passing checks require a full watch and listen of this exact export.",
      });
    if (Object.values(review.checks).includes("fix") && !review.notes)
      ctx.addIssue({
        code: "custom",
        message: "Add timestamps and the correction needed for a failed check.",
      });
  });
export type ReelReviewSave = z.infer<typeof reelReviewSaveSchema>;
export const savedReelReviewSchema = z.object({
  review: reelReviewSaveSchema,
  reviewerId: z.number().int().positive(),
  reviewedAt: z.string().datetime(),
});

export function reelReviewOutcome(review: ReelReviewSave) {
  if (Object.values(review.checks).includes("fix")) return "Changes identified";
  return review.watchedAndListened &&
    Object.values(review.checks).every((value) => value === "pass")
    ? "Human review complete"
    : "Review incomplete";
}
