import { ARCHIVE_REGIONS } from "../../shared/archiveScope";
import { publicEdition } from "../core/publicEdition";
import { publicFeedItem } from "../core/publicFeedItem";
import { z } from "zod";
import * as db from "../db";
import { publicProcedure, router } from "../core/trpc";

export const searchRouter = router({
  all: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        category: z.string().max(40).optional(),
        region: z.enum(ARCHIVE_REGIONS).optional(),
        since: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        sort: z.enum(["relevance", "latest"]).optional(),
      })
    )
    .query(async ({ input }) => {
      const result = await db.searchAllContent(input.query, { ...input, limit: 51 });
      return {
        hasMoreFeedItems: result.feedItems.length > 50,
        hasMoreEditions: result.editions.length > 50,
        feedItems: result.feedItems.slice(0, 50).map((item) => publicFeedItem(item, input.query)),
        editions: result.editions
          .slice(0, 50)
          .map((ed) => ({ ...publicEdition(ed), snippet: ed.snippet })),
      };
    }),
});
