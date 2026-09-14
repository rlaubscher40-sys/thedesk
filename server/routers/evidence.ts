import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../core/trpc";
import { getPropertyEvidence, searchPropertyEvidence } from "../db/evidence";
import { evidenceEligible, evidenceText } from "../../shared/evidenceQuality";

export const evidenceRouter = router({
  get: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const item = await getPropertyEvidence(input.id);
      if (!item)
        throw new TRPCError({ code: "NOT_FOUND", message: "This evidence record is unavailable." });
      return {
        ...item,
        ...evidenceText(item),
        excluded: !evidenceEligible(item, new Date().toISOString().slice(0, 10)),
      };
    }),
  search: publicProcedure
    .input(z.object({ query: z.string().trim().min(2).max(240) }))
    .query(({ input }) => searchPropertyEvidence(input.query)),
});
