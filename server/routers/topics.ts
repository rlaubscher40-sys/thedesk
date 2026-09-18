import { ARCHIVE_REGIONS, archiveCursorSchema } from "../../shared/archiveScope";
import { cached, cacheKey } from "../core/cache";
import { publicEdition } from "../core/publicEdition";
import { publicFeedItem } from "../core/publicFeedItem";
import { z } from "zod";
import * as db from "../db";
import { publicProcedure, router } from "../core/trpc";

const archiveFiltersSchema = z.object({
  region: z.enum(ARCHIVE_REGIONS).optional(),
  since: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const topicsRouter = router({
  /** Aggregate feed items + edition topics for a category. */
  getByCategory: publicProcedure
    .input(
      archiveFiltersSchema.extend({
        category: z.string().min(1).max(40),
        limit: z.number().int().min(1).max(100).default(100),
        before: archiveCursorSchema.optional(),
      })
    )
    .query(async ({ input }) => {
      const [feedItems, editions] = await Promise.all([
        db.getFeedItemsByCategory(input.category, input.limit + 1, input),
        input.region || input.since || input.before
          ? Promise.resolve([])
          : db.getEditionsByCategory(input.category),
      ]);
      const page = feedItems.slice(0, input.limit);
      const last = page.at(-1);
      return {
        feedItems: page.map((item) => publicFeedItem(item)),
        editions: editions.map(publicEdition),
        nextCursor:
          feedItems.length > input.limit && last ? { feedDate: last.feedDate, id: last.id } : null,
      };
    }),

  list: publicProcedure.query(async () => db.listAllCategories()),

  /** All-time counts per category, used to colour the Topics overview. */
  itemCounts: publicProcedure
    .input(archiveFiltersSchema.optional())
    .query(async ({ input }) =>
      cached(cacheKey("feed:archiveCounts", input), 30_000, () => db.getCategoryHeat(3650, input))
    ),

  /** Up to 3 most recent feed items per category, grouped. */
  recentByCategory: publicProcedure
    .input(archiveFiltersSchema.optional())
    .query(async ({ input }) => {
      const all = input
        ? await cached(cacheKey("feed:archiveRecent", input), 30_000, async () => {
            const categories = await db.getCategoryHeat(3650, input);
            return (
              await Promise.all(
                categories.map(({ category }) => db.getFeedItemsByCategory(category, 3, input))
              )
            ).flat();
          })
        : await db.listFeedItems();
      const grouped: Record<string, typeof all> = {};
      for (const item of all) {
        const cat = (item.category || "OTHER").toUpperCase();
        grouped[cat] ??= [];
        if (grouped[cat]!.length < 3) grouped[cat]!.push(publicFeedItem(item));
      }
      return grouped;
    }),
});
