/**
 * Public read of the daily-refreshed metrics strip + admin upsert so the
 * editor can add or override metrics that aren't covered by the automated
 * ingest (CPI, unemployment, auction clearance, etc.).
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { consumeAnonymousCard } from "../core/askQuota";
import * as db from "../db";
import { renderNumberCard } from "../og/numberCard";
import { adminProcedure, publicProcedure, router } from "../core/trpc";

function safeFilename(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `the-number-${slug || "metric"}.png`;
}

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
   * Render one live metric as a native 4:5 distribution asset. The input is
   * only a metric key, never arbitrary card copy, so a shared "The Number"
   * graphic can only contain data currently stored by The Desk.
   */
  shareCard: publicProcedure
    .input(z.object({ metricKey: z.string().min(1).max(64) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        const quota = consumeAnonymousCard(ctx.req);
        if (!quota.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `You've used today's ${quota.limit} free share cards. Sign in to keep going.`,
          });
        }
      }

      const metrics = await db.listDailyMetrics();
      const metric = metrics.find((row) => row.metricKey === input.metricKey);
      if (!metric) {
        throw new TRPCError({ code: "NOT_FOUND", message: "That metric is no longer available." });
      }

      try {
        const png = await renderNumberCard(metric);
        return {
          mimeType: "image/png" as const,
          filename: safeFilename(metric.label),
          base64: png.toString("base64"),
        };
      } catch (error) {
        console.error("[metrics] number card render failed", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The Desk could not render that number card.",
        });
      }
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
