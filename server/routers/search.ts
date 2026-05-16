import { z } from "zod";
import * as db from "../db";
import { publicProcedure, router } from "../core/trpc";

export const searchRouter = router({
  all: publicProcedure
    .input(z.object({ query: z.string().min(1).max(200) }))
    .query(async ({ input }) => db.searchAllContent(input.query)),
});
