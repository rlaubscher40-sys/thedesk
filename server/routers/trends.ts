import { z } from "zod";
import * as db from "../db";
import { publicProcedure, router } from "../core/trpc";

export const trendsRouter = router({
  metricHistory: publicProcedure
    .input(z.object({ limit: z.number().int().min(2).max(20).optional() }).optional())
    .query(async ({ input }) => db.getMetricHistory(input?.limit ?? 12)),

  categoryHeat: publicProcedure
    .input(z.object({ days: z.number().int().min(7).max(90).optional() }).optional())
    .query(async ({ input }) => db.getCategoryHeat(input?.days ?? 30)),

  signalFrequency: publicProcedure
    .input(z.object({ editionLimit: z.number().int().min(2).max(20).optional() }).optional())
    .query(async ({ input }) => db.getSignalFrequency(input?.editionLimit ?? 8)),

  weeklyComparison: publicProcedure
    .input(z.object({ limit: z.number().int().min(2).max(8).optional() }).optional())
    .query(async ({ input }) => db.getRecentEditionsForMetrics(input?.limit ?? 4)),
});
