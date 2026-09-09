import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { consumeAnonymousCard } from "../core/askQuota";
import * as db from "../db";
import { renderSignalCard } from "../core/publicRender";
import { publicProcedure, router } from "../core/trpc";

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

function pctMove(first: number, last: number): number {
  if (Math.abs(first) < 0.000001) return last - first;
  return ((last - first) / Math.abs(first)) * 100;
}

function formatMove(series: Array<{ value: number; recordedAt: Date }>): string | null {
  if (series.length < 2) return null;
  const first = series[0]?.value;
  const last = series[series.length - 1]?.value;
  if (typeof first !== "number" || typeof last !== "number") return null;
  const move = pctMove(first, last);
  if (!Number.isFinite(move)) return null;
  const sign = move > 0 ? "+" : "";
  return `${sign}${move.toFixed(Math.abs(move) >= 10 ? 1 : 2)}% across 30-day recorded history`;
}

function formatAsOf(value: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(value);
}

export const signalsRouter = router({
  /**
   * Render The Number from a trusted metric key only. All visible copy comes
   * from current Desk data, its 30-day history and the latest published Desk
   * Take, so a public caller cannot manufacture a branded statistic or source.
   */
  shareCard: publicProcedure
    .input(z.object({ metricKey: z.string().min(1).max(64) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        const quota = await consumeAnonymousCard(ctx.req);
        if (!quota.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `You've used today's ${quota.limit} free social-card renders. Sign in to keep going.`,
          });
        }
      }

      const [metrics, histories, editions] = await Promise.all([
        db.listDailyMetrics(),
        db.listMetricHistories(30),
        db.listEditionSummaries(),
      ]);
      const metric = metrics.find((row) => row.metricKey === input.metricKey);
      if (!metric) {
        throw new TRPCError({ code: "NOT_FOUND", message: "That signal is no longer available." });
      }
      const latestTake = editions.find((edition) => edition.rubensTake?.trim())?.rubensTake ?? null;

      try {
        const png = await renderSignalCard({
          label: metric.label,
          value: displayValue(metric.value, metric.unit),
          context: metric.context ?? null,
          move: formatMove(histories[metric.metricKey] ?? []),
          deskTake: latestTake,
          source: metric.source ?? null,
          asOf: formatAsOf(metric.asOf),
        });
        return {
          mimeType: "image/png" as const,
          filename: "the-desk-the-number.png",
          base64: png.toString("base64"),
          sharePath: `/signals?metric=${encodeURIComponent(metric.metricKey)}`,
          label: metric.label,
          value: displayValue(metric.value, metric.unit),
        };
      } catch (error) {
        console.error("[signals] card render failed", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The Desk could not render the signal card.",
        });
      }
    }),
});
