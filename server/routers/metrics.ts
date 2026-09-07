/**
 * Public read of the daily-refreshed metrics strip + admin upsert so the
 * editor can add or override metrics that aren't covered by the automated
 * ingest (CPI, unemployment, auction clearance, etc.).
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { consumeAnonymousCard } from "../core/askQuota";
import * as db from "../db";
import { renderSignalCard } from "../og/signalCard";
import { adminProcedure, publicProcedure, router } from "../core/trpc";

function safeFilename(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `the-number-${slug || "metric"}.png`;
}

function displayValue(value: string, unit: string | null): string {
  const cleanValue = value.trim();
  const cleanUnit = unit?.trim();
  if (!cleanUnit) return cleanValue;
  if (cleanUnit === "%" && cleanValue.includes("%")) return cleanValue;
  if (cleanUnit === "$" && cleanValue.startsWith("$")) return cleanValue;
  if (["%", "°", "x"].includes(cleanUnit)) return `${cleanValue}${cleanUnit}`;
  if (cleanUnit === "$") return `$${cleanValue}`;
  return `${cleanValue} ${cleanUnit}`;
}

function formatAsOf(value: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(value);
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
   * Render one live metric as the same hook-first 4:5 "The Number" asset used
   * by Signals. The input is only a metric key, never arbitrary card copy, so
   * a Trends share is guaranteed to reflect a currently stored Desk metric.
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
        const png = await renderSignalCard({
          label: metric.label,
          value: displayValue(metric.value, metric.unit),
          context: metric.context ?? null,
          move: metric.previousValue
            ? `Previous recorded value ${displayValue(metric.previousValue, metric.unit)}`
            : null,
          deskTake: null,
          source: metric.source ?? null,
          asOf: formatAsOf(metric.asOf),
        });
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
