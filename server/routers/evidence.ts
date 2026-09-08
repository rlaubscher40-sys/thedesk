import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../core/trpc";
import { getPropertyEvidence, searchPropertyEvidence } from "../db/evidence";

export const evidenceRouter = router({
  get: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const item = await getPropertyEvidence(input.id);
      if (!item)
        throw new TRPCError({ code: "NOT_FOUND", message: "This evidence record is unavailable." });
      return item;
    }),
  search: publicProcedure
    .input(z.object({ query: z.string().trim().min(2).max(240) }))
    .query(({ input }) => searchPropertyEvidence(input.query)),
});
