import { z } from "zod";
import * as db from "../db";
import { protectedProcedure, router } from "../core/trpc";

const queueIdInput = z.object({ id: z.number().int().positive() });

export const readingQueueRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => db.getEnrichedQueue(ctx.user.id)),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const items = await db.getEnrichedQueue(ctx.user.id);
    return items.filter((i) => !i.isRead).length;
  }),

  add: protectedProcedure
    .input(
      z
        .object({
          feedItemId: z.number().int().positive().optional(),
          customUrl: z.string().url().optional(),
          customTitle: z.string().min(1).optional(),
        })
        // Each entry needs either a feed item or a custom URL+title.
        .refine((v) => v.feedItemId || (v.customUrl && v.customTitle), {
          message: "Provide either feedItemId or customUrl+customTitle",
        })
    )
    .mutation(async ({ ctx, input }) => {
      let resolvedTitle = input.customTitle ?? null;
      let resolvedUrl = input.customUrl ?? null;
      if (input.feedItemId) {
        const item = await db.getFeedItemById(input.feedItemId);
        if (item) {
          resolvedTitle ??= item.title;
          resolvedUrl ??= item.sourceUrl ?? null;
        }
      }
      await db.addToQueue({
        userId: ctx.user.id,
        feedItemId: input.feedItemId ?? null,
        customUrl: resolvedUrl,
        customTitle: resolvedTitle,
      });
      return { success: true };
    }),

  markRead: protectedProcedure.input(queueIdInput).mutation(async ({ ctx, input }) => {
    await db.markQueueItemRead(input.id, ctx.user.id);
    return { success: true };
  }),

  remove: protectedProcedure.input(queueIdInput).mutation(async ({ ctx, input }) => {
    await db.removeFromQueue(input.id, ctx.user.id);
    return { success: true };
  }),

  clearAll: protectedProcedure.mutation(async ({ ctx }) => {
    await db.clearQueue(ctx.user.id);
    return { success: true };
  }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db.markAllQueueRead(ctx.user.id);
    return { success: true };
  }),
});
