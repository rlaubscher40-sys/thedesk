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

  /** Top paths and top referrers over a rolling window. */
  breakdown: adminProcedure.input(windowSchema).query(async ({ input }) => {
    const hours = input?.hours ?? 24;
    const [paths, referrers] = await Promise.all([
      db.topPaths(hours, 10),
      db.topReferrers(hours, 10),
    ]);
    return { paths, referrers };
  }),

  /** Per-day view counts across the last N days for a sparkline. */
  byDay: adminProcedure
    .input(z.object({ days: z.number().int().min(1).max(90).default(30) }).optional())
    .query(async ({ input }) => {
      return db.pageViewsByDay(input?.days ?? 30);
    }),
});
