import { z } from "zod";
import * as db from "../db";
import { adminProcedure, publicProcedure, router } from "../core/trpc";
import { generateSayThis } from "../prompts";

const feedDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "feedDate must be YYYY-MM-DD");

export const feedRouter = router({
  /** Today's items by default, or items for a specific YYYY-MM-DD. */
  getByDate: publicProcedure
    .input(z.object({ date: feedDateSchema.optional() }).optional())
    .query(async ({ input }) => db.listFeedItems(input?.date)),

  /** A single feed item by id, used by the /story/:id page. */
  getById: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => db.getFeedItemById(input.id)),

  /** Dates that have at least one feed item, newest first. */
  getRecentDates: publicProcedure.query(async () => db.getRecentFeedDates()),

  /** Paginated archive across all dates, optionally filtered by category. */
  archive: publicProcedure
    .input(
      z.object({
        category: z.string().max(64).optional(),
        limit: z.number().int().min(1).max(60).default(30),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => db.listArchive(input)),

  /**
   * Admin: fill in missing `sayThis` lines for recent feed items. Runs the LLM
   * once per item; safe to re-run because items with a populated `sayThis` are
   * skipped. Returns counts so the Admin console can show the result.
   */
  backfillSayThis: adminProcedure
    .input(
      z.object({ limit: z.number().int().min(1).max(100).default(20) }).optional()
    )
    .mutation(async ({ input }) => {
      const limit = input?.limit ?? 20;
      const items = await db.listFeedItemsMissingSayThis(limit);
      let updated = 0;
      let skipped = 0;
      for (const item of items) {
        const line = await generateSayThis({
          title: item.title,
          summary: item.summary,
          category: item.category,
        });
        if (!line) {
          skipped++;
          continue;
        }
        await db.updateFeedItemSayThis(item.id, line);
        updated++;
      }
      return { scanned: items.length, updated, skipped };
    }),

  /**
   * Admin: delete a single feed item by id. Used to clean up off-topic
   * stories that slip through the ingest filters (e.g. a sport story
   * mis-tagged POLICY).
   */
  deleteItem: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await db.deleteFeedItem(input.id);
      return { success: true } as const;
    }),

  /**
   * Admin: attach a "Ruben's note" to a feed item. The note appears on
   * the story card as a highlighted editorial quote, overriding the AI's
   * sayThis line visually. Pass an empty string to clear.
   */
  setRubensNote: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        note: z.string().max(600),
      })
    )
    .mutation(async ({ input }) => {
      const trimmed = input.note.trim();
      await db.updateFeedItemRubensNote(input.id, trimmed.length > 0 ? trimmed : null);
      return { success: true } as const;
    }),
});
