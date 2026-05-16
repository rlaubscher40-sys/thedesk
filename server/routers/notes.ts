import { z } from "zod";
import * as db from "../db";
import { protectedProcedure, router } from "../core/trpc";

const weekIdSchema = z.string().regex(/^\d{4}-W\d{1,2}$/u, "weekId must look like 2026-W17");

export const notesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => db.listNotes(ctx.user.id)),

  get: protectedProcedure
    .input(z.object({ weekId: weekIdSchema }))
    .query(async ({ ctx, input }) => {
      const note = await db.getNote(ctx.user.id, input.weekId);
      // Return a default-shaped record so the UI doesn't have to special-case null.
      if (note) return note;
      const now = new Date();
      return {
        id: 0,
        userId: ctx.user.id,
        weekId: input.weekId,
        content: "",
        updatedAt: now,
        createdAt: now,
      };
    }),

  save: protectedProcedure
    .input(z.object({ weekId: weekIdSchema, content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db.upsertNote({
        userId: ctx.user.id,
        weekId: input.weekId,
        content: input.content,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ weekId: weekIdSchema }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteNote(ctx.user.id, input.weekId);
      return { success: true };
    }),
});
