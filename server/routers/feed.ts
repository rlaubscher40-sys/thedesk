import { z } from "zod";
import * as db from "../db";
import { publicProcedure, router } from "../core/trpc";

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
});
