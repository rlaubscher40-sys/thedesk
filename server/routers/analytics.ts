/**
 * Admin-only analytics router.
 *
 * Reads privacy-preserving aggregates off the self-hosted analytics store.
 * Page-view and engagement writes arrive through Express endpoints; this
 * router is read-only and curator-gated.
 */
import { z } from "zod";
import * as db from "../db";
import { adminProcedure, router } from "../core/trpc";

const windowSchema = z
  .object({
    hours: z
      .number()
      .int()
      .min(1)
      .max(24 * 90)
      .default(24),
  })
  .optional();

export const analyticsRouter = router({
  social: adminProcedure
    .input(windowSchema)
    .query(({ input }) => db.socialPerformance(input?.hours ?? 24 * 28)),
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

  breakdown: adminProcedure.input(windowSchema).query(async ({ input }) => {
    const hours = input?.hours ?? 24;
    const [paths, referrers] = await Promise.all([
      db.topPaths(hours, 10),
      db.topReferrers(hours, 10),
    ]);
    return { paths, referrers };
  }),

  byDay: adminProcedure
    .input(z.object({ days: z.number().int().min(1).max(90).default(30) }).optional())
    .query(async ({ input }) => {
      return db.pageViewsByDay(input?.days ?? 30);
    }),

  /** Product actions are kept separate from page-view totals. */
  engagement: adminProcedure.input(windowSchema).query(async ({ input }) => {
    const hours = input?.hours ?? 24 * 7;
    return db.engagementSummary(hours, 20);
  }),
});
