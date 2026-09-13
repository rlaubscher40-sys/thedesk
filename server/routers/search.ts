import { publicEdition } from "../core/publicEdition";
import { z } from "zod";
import * as db from "../db";
import { publicProcedure, router } from "../core/trpc";

export const searchRouter = router({
  all: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        category: z.string().max(40).optional(),
        since: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        sort: z.enum(["relevance", "latest"]).optional(),
      })
    )
    .query(async ({ input }) => {
      const result = await db.searchAllContent(input.query, input);
      return {
        feedItems: result.feedItems,
        editions: result.editions.map((ed) => ({ ...publicEdition(ed), snippet: ed.snippet })),
      };
    }),
});
