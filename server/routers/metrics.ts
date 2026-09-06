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

  /**
   * Last 30 days of numeric history per metricKey, for sparklines. Cached
   * client-side longer than `list` because it doesn't change within a day.
   */
  histories: publicProcedure.query(async () => {
    return db.listMetricHistories(30);
  }),

  /**
   * The month, told through our own numbers.
   *
   * Public because it is the franchise, not an internal report: the whole point
   * of this series is that it is ours to publish. Defaults to the last complete
   * month, since a review of a month still running would report a partial month
   * as a finished one.
   */
  monthlyReview: publicProcedure
    .input(
      z
        .object({
          month: z
            .string()
            .regex(/^\d{4}-\d{2}$/)
            .optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const { buildMonthlyReview, readMonth } = await import("../metrics/monthlyReview");
      // 400 days: enough for a full year of prior months plus the month being
      // reviewed, which is what the ranking needs to know what ordinary is.
      const [metrics, histories] = await Promise.all([
        db.listDailyMetrics(),
        db.listMetricHistories(400),
      ]);
      const review = buildMonthlyReview(
        metrics.map((m) => ({
          metricKey: m.metricKey,
          label: m.label,
          unit: m.unit,
          groupKey: m.groupKey,
        })),
        histories,
        input?.month
      );
      return { ...review, reading: readMonth(review) };
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
        context: z.string().max(256).optional().nullable(),
        groupKey: z.string().max(32).optional().nullable(),
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
        context: input.context ?? null,
        groupKey: input.groupKey ?? null,
        asOf: new Date(),
        displayOrder: input.displayOrder,
      });
      return { success: true } as const;
    }),
});
