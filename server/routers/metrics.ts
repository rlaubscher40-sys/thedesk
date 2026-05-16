/**
 * Public read of the daily-refreshed metrics strip + admin upsert so the
 * editor can add or override metrics that aren't covered by the automated
 * ingest (CPI, unemployment, auction clearance, etc.).
 */
import { z } from "zod";
import * as db from "../db";
import { adminProcedure, publicProcedure, router } from "../core/trpc";

export const metricsRouter = router({
  list: publicProcedure.query(async () => {
    return db.listDailyMetrics();
  }),

  listAll: adminProcedure.query(async () => {
    return db.listDailyMetrics();
  }),

  upsert: adminProcedure
    .input(
      z.object({
        metricKey: z.string().min(1).max(64),
        label: z.string().min(1).max(128),
        value: z.string().min(1).max(64),
        unit: z.string().max(16).optional().nullable(),
        source: z.string().max(64).optional().nullable(),
        displayOrder: z.number().int().min(0).max(9999).optional(),
      })
    )
    .mutation(async ({ input }) => {
      await db.upsertDailyMetric({
        metricKey: input.metricKey,
        label: input.label,
        value: input.value,
        unit: input.unit ?? null,
        source: input.source ?? "Manual",
        asOf: new Date(),
        displayOrder: input.displayOrder,
      });
      return { success: true } as const;
    }),
});
