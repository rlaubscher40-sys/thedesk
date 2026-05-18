/**
 * Admin-only health router.
 *
 * Surfaces what only the app itself can see: env-var coverage, recent
 * exceptions, uptime over a rolling window, ingest cadence (latest
 * edition publishedAt, latest daily-feed item createdAt, latest
 * metric updatedAt), subscriber pipeline state.
 *
 * External tools (Sentry, BetterStack) cover the same axes from
 * outside; this router is the inside-out complement.
 */
import { z } from "zod";
import * as db from "../db";
import type { Subscriber, DailyMetric } from "../db/schema";
import { adminProcedure, router } from "../core/trpc";

const envFlag = (name: string) => Boolean(process.env[name]);

export const healthRouter = router({
  /** Headline service-health summary for the admin dashboard. */
  summary: adminProcedure.query(async () => {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [errors24h, errors7d, uptime24h, uptime7d, editions, feed, metrics, subs] =
      await Promise.all([
        db.countServerErrorsSince(dayAgo),
        db.countServerErrorsSince(weekAgo),
        db.uptimeWindowStats(24),
        db.uptimeWindowStats(24 * 7),
        db.listEditions().catch(() => []),
        db.listFeedItems().catch(() => []),
        db.listDailyMetrics().catch((): DailyMetric[] => []),
        db.listSubscribers().catch((): Subscriber[] => []),
      ]);

    const latestEdition = editions[0] ?? null;
    const latestFeedItem = feed[0] ?? null;
    const latestMetric =
      metrics
        .slice()
        .sort(
          (a: DailyMetric, b: DailyMetric) =>
            b.updatedAt.getTime() - a.updatedAt.getTime()
        )[0] ?? null;

    return {
      env: {
        anthropic: envFlag("ANTHROPIC_API_KEY"),
        openai: envFlag("OPENAI_API_KEY"),
        sentry: envFlag("SENTRY_DSN"),
        resend: envFlag("RESEND_API_KEY"),
        plausible: envFlag("VITE_PLAUSIBLE_DOMAIN"),
        siteUrl: envFlag("SITE_URL") || envFlag("VITE_SITE_URL"),
        scheduledKey: envFlag("SCHEDULED_API_KEY"),
        database: envFlag("DATABASE_URL"),
      },
      errors: {
        last24h: errors24h,
        last7d: errors7d,
      },
      uptime: {
        last24h: {
          total: uptime24h.total,
          up: uptime24h.up,
          percent: uptime24h.total
            ? Math.round((uptime24h.up / uptime24h.total) * 1000) / 10
            : null,
          avgLatencyMs: uptime24h.avgLatencyMs,
        },
        last7d: {
          total: uptime7d.total,
          up: uptime7d.up,
          percent: uptime7d.total
            ? Math.round((uptime7d.up / uptime7d.total) * 1000) / 10
            : null,
          avgLatencyMs: uptime7d.avgLatencyMs,
        },
      },
      ingest: {
        latestEditionPublishedAt: latestEdition?.publishedAt ?? null,
        latestEditionNumber: latestEdition?.editionNumber ?? null,
        latestFeedItemAt: latestFeedItem?.createdAt ?? null,
        latestFeedItemTitle: latestFeedItem?.title ?? null,
        latestMetricAt: latestMetric?.updatedAt ?? null,
      },
      subscribers: {
        total: subs.length,
        confirmed: subs.filter(
          (s: Subscriber) => s.confirmedAt && !s.unsubscribedAt
        ).length,
        pendingConfirm: subs.filter(
          (s: Subscriber) => !s.confirmedAt && !s.unsubscribedAt
        ).length,
        unsubscribed: subs.filter((s: Subscriber) => Boolean(s.unsubscribedAt))
          .length,
      },
    };
  }),

  /** Most recent server errors. Used to render the stack trace list. */
  recentErrors: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
    .query(async ({ input }) => {
      return db.listRecentServerErrors(input?.limit ?? 50);
    }),

  /** Raw uptime pings, newest first. Caller renders a sparkline. */
  uptimePings: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(600).default(288) }).optional())
    .query(async ({ input }) => {
      return db.listRecentUptimePings(input?.limit ?? 288);
    }),

  /** Clear the server_errors table. Useful after fixing a noisy bug. */
  clearErrors: adminProcedure.mutation(async () => {
    await db.clearServerErrors();
    return { ok: true } as const;
  }),
});
