import { z } from "zod";
import * as db from "../db";
import { protectedProcedure, router } from "../core/trpc";

export const conversationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => db.listConversationEntries(ctx.user.id)),

  track: protectedProcedure
    .input(
      z.object({
        editionId: z.number().int().positive().optional(),
        lineText: z.string().min(1),
        usedWithCategory: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db.addConversationEntry({
        userId: ctx.user.id,
        editionId: input.editionId ?? null,
        lineText: input.lineText,
        usedWithCategory: input.usedWithCategory ?? null,
      });
      return { success: true };
    }),
});
