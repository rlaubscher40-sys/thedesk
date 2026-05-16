/**
 * Public read of the daily-refreshed metrics strip.
 */
import * as db from "../db";
import { publicProcedure, router } from "../core/trpc";

export const metricsRouter = router({
  list: publicProcedure.query(async () => {
    return db.listDailyMetrics();
  }),
});
