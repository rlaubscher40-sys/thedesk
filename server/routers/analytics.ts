/**
 * Admin-only analytics router.
 *
 * Reads aggregates off the `page_views` table. The browser-side
 * tracker (client/src/lib/analytics.ts) writes via the public
 * /api/analytics/pageview Express route; this router is read-only and
 * gated behind adminProcedure so only the curator can see the
 * numbers.
 */
import { z } from "zod";
import * as db from "../db";
import { adminProcedure, router } from "../core/trpc";

const windowSchema = z
  .object({ hours: z.number().int().min(1).max(24 * 90).default(24) })
  .optional();

export const analyticsRouter = router({
  /** Headline counts over a rolling window (default 24h). */
  summary: adminProcedure.input(windowSchema).query(async ({ input }) => {
    const hours = input?.hours ?? 24;
    const [now, week, month] = await Promise.all([
      db.pageViewSummary(hours),
      db.pageViewSummary(24 * 7),
      db.pageViewSummary(24 * 30),
    ]);
    return {
      window: { hours, ...now },
      last7d: week,
      last30d: month,
    };
  }),

  /** Top paths, referrers and countries over a rolling window. */
  breakdown: adminProcedure.input(windowSchema).query(async ({ input }) => {
    const hours = input?.hours ?? 24;
    const [paths, referrers, countries] = await Promise.all([
      db.topPaths(hours, 10),
      db.topReferrers(hours, 10),
      db.topCountries(hours, 10),
    ]);
    return { paths, referrers, countries };
  }),

  /** Australian share of readership. Defaults to a 30-day window —
   *  the daily numbers on a site this size are too small for a
   *  percentage to mean anything, and the whole point of this figure
   *  is to track a trend rather than a day. */
  audience: adminProcedure
    .input(
      z
        .object({ hours: z.number().int().min(1).max(24 * 90).default(24 * 30) })
        .optional()
    )
    .query(async ({ input }) => {
      const hours = input?.hours ?? 24 * 30;
      const split = await db.countrySplit(hours);
      const known = split.au + split.other;
      return {
        hours,
        ...split,
        /** AU share of views with a known country, 0-100. null when
         *  nothing is attributable yet — the panel renders a dash
         *  rather than a misleading 0%. */
        auShare: known > 0 ? Math.round((split.au / known) * 100) : null,
      };
    }),

  /** Per-day view counts across the last N days for a sparkline. */
  byDay: adminProcedure
    .input(z.object({ days: z.number().int().min(1).max(90).default(30) }).optional())
    .query(async ({ input }) => {
      return db.pageViewsByDay(input?.days ?? 30);
    }),
});
