import { z } from "zod";
import { adminProcedure, router } from "../core/trpc";
import { PUBLICATION_CHANNELS } from "../../shared/publicationControls";
import {
  publicationControls,
  publicationControlEvents,
  setPublicationControl,
} from "../db/publicationControls";
import { decideLegalReview, pendingLegalReviews, holdPublishedStory } from "../db/legalReview";
import { privacyRequestInventory } from "../db/privacyOperations";

export const legalRouter = router({
  holdStory: adminProcedure
    .input(
      z.object({
        feedItemId: z.number().int().positive(),
        note: z.string().trim().min(20).max(1000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await holdPublishedStory({ ...input, actorId: ctx.user.id });
      return { ok: true };
    }),
  privacyInventory: adminProcedure
    .input(
      z.object({
        email: z
          .string()
          .trim()
          .email()
          .max(320)
          .transform((v) => v.toLowerCase()),
      })
    )
    .mutation(({ input }) => privacyRequestInventory(input.email)),
  controls: adminProcedure.query(() => publicationControls()),
  events: adminProcedure.query(() => publicationControlEvents()),
  setControl: adminProcedure
    .input(
      z.object({
        channel: z.enum(PUBLICATION_CHANNELS),
        paused: z.boolean(),
        reason: z.string().trim().min(5).max(500),
        expectedRevision: z.number().int().min(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await setPublicationControl({ ...input, actorId: ctx.user.id });
      return { ok: true };
    }),
  reviews: adminProcedure.query(() => pendingLegalReviews()),
  decideReview: adminProcedure
    .input(
      z.object({
        feedItemId: z.number().int().positive(),
        decision: z.enum(["approve", "reject"]),
        note: z.string().trim().min(20).max(1000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await decideLegalReview({ ...input, actorId: ctx.user.id });
      return { ok: true };
    }),
});
