/**
 * Instagram posts admin router.
 *
 * Admin:
 *   · listAll — recent posts with engagement metrics, newest first.
 *   · preview — render the cards that WOULD post (daily or latest weekly)
 *               from live data, returned as base64. Publishes nothing and
 *               records nothing: a morning sign-off / dry-run tool.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { listInstagramPosts } from "../db/instagramPosts";
import { listFeedItems } from "../db/feed";
import { listEditions } from "../db/editions";
import { adminProcedure, router } from "../core/trpc";

export const instagramRouter = router({
  listAll: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(30) }).optional())
    .query(async ({ input }) => {
      return listInstagramPosts(input?.limit ?? 30);
    }),

  preview: adminProcedure
    .input(
      z.object({
        kind: z.enum(["daily", "weekly"]).default("daily"),
        feedDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Dynamic import so the satori/sharp render stack only loads when a
      // preview is actually requested, not on every server boot.
      const { previewDailyCarousel, previewWeeklyEdition } = await import(
        "../instagram/post"
      );
      if (input.kind === "weekly") {
        const editions = await listEditions();
        const latest = editions[0];
        if (!latest) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No editions available to preview.",
          });
        }
        return previewWeeklyEdition(latest);
      }
      const items = await listFeedItems(input.feedDate);
      if (items.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No feed items for that date to preview.",
        });
      }
      return previewDailyCarousel(items);
    }),
});
