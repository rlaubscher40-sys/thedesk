import { z } from "zod";
import * as db from "../db";
import { publicProcedure, router } from "../core/trpc";

export const topicsRouter = router({
  /** Aggregate feed items + edition topics for a category. */
  getByCategory: publicProcedure.input(z.object({ category: z.string().min(1) })).query(async ({ input }) => {
    const [feedItems, editions] = await Promise.all([
      db.getFeedItemsByCategory(input.category),
      db.getEditionsByCategory(input.category),
    ]);
    return { feedItems, editions };
  }),

  list: publicProcedure.query(async () => db.listAllCategories()),

  /** All-time counts per category, used to colour the Topics overview. */
  itemCounts: publicProcedure.query(async () => db.getCategoryHeat(3650)),

  /** Up to 3 most recent feed items per category, grouped. */
  recentByCategory: publicProcedure.query(async () => {
    const all = await db.listFeedItems();
    const grouped: Record<string, typeof all> = {};
    for (const item of all) {
      const cat = (item.category || "OTHER").toUpperCase();
      grouped[cat] ??= [];
      if (grouped[cat]!.length < 3) grouped[cat]!.push(item);
    }
    return grouped;
  }),
});
