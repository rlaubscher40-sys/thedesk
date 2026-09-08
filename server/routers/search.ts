import { publicEdition } from "../core/publicEdition";
import { z } from "zod";
import * as db from "../db";
import { publicProcedure, router } from "../core/trpc";

export const searchRouter = router({
  all: publicProcedure
    .input(z.object({ query: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const result = await db.searchAllContent(input.query);
      return {
        feedItems: result.feedItems,
        editions: result.editions.map((ed) => ({ ...publicEdition(ed), snippet: ed.snippet })),
      };
    }),
});
