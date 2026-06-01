import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { CATCHUP_STATEMENTS, runCatchup } from "../db/catchup";
import { isDemoMode } from "../demo/store";
import { adminProcedure, publicProcedure, router } from "../core/trpc";

/**
 * System endpoints. demoMode is public; the maintenance helpers are admin-
 * only and exist so the editor can run one-off DB chores (migrations,
 * cleanup) from the admin panel without opening a SQL editor.
 *
 * The catch-up statement list and its runner live in `../db/catchup` so the
 * server can also apply them automatically on boot (see server/index.ts),
 * not just when an admin clicks the maintenance button.
 */

export const systemRouter = router({
  demoMode: publicProcedure.query(() => ({ demoMode: isDemoMode() })),

  /**
   * Apply any catch-up migrations that haven't run yet. Safe to re-run —
   * statements that fail with "duplicate column / table already exists"
   * are treated as already-applied.
   */
  catchupDatabase: adminProcedure.mutation(async () => {
    if (isDemoMode()) {
      return {
        ok: true,
        demoMode: true,
        applied: [],
        skipped: CATCHUP_STATEMENTS.map((s) => s.name),
        failed: [],
      };
    }
    const db = getDb();
    if (!db) {
      throw new Error("Database not configured");
    }

    const report = await runCatchup(db);
    return {
      ok: report.failed.length === 0,
      demoMode: false,
      ...report,
    };
  }),

  /**
   * Delete a single edition by editionNumber. Used by the catch-up flow
   * to clear a thin edition from before the new prompts shipped. The
   * full delete-edition mutation also exists on the editions router,
   * but this slimmer version lives next to catchupDatabase so the admin
   * UI has one obvious place for the recovery flow.
   */
  deleteEditionByNumber: adminProcedure
    .input(z.object({ editionNumber: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      if (isDemoMode()) {
        return { ok: true, demoMode: true, deletedCount: 0 };
      }
      const db = getDb();
      if (!db) throw new Error("Database not configured");
      const result = await db.execute(
        sql`DELETE FROM editions WHERE editionNumber = ${input.editionNumber}`
      );
      const affected =
        (result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0;
      return { ok: true, demoMode: false, deletedCount: affected };
    }),

  /**
   * Wipe ALL feed items. Used to reset the Today/Archive feed before a
   * fresh daily-feed workflow run. The `confirm` payload guards against
   * accidental fires from the typed-client perspective, the UI passes
   * the literal string "WIPE" to acknowledge the action.
   */
  purgeFeed: adminProcedure
    .input(z.object({ confirm: z.literal("WIPE") }))
    .mutation(async () => {
      if (isDemoMode()) return { ok: true, demoMode: true, deletedCount: 0 };
      const db = getDb();
      if (!db) throw new Error("Database not configured");
      const result = await db.execute(sql`DELETE FROM daily_feed_items`);
      const affected =
        (result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0;
      return { ok: true, demoMode: false, deletedCount: affected };
    }),

  /**
   * Wipe ALL daily metrics + the metric history table. Used before
   * re-running the daily-metrics workflow to get a clean slate. The
   * history table goes too so the sparklines redraw from scratch.
   */
  purgeMetrics: adminProcedure
    .input(z.object({ confirm: z.literal("WIPE") }))
    .mutation(async () => {
      if (isDemoMode()) return { ok: true, demoMode: true, deletedCount: 0 };
      const db = getDb();
      if (!db) throw new Error("Database not configured");
      const m = await db.execute(sql`DELETE FROM daily_metrics`);
      let historyAffected = 0;
      try {
        const h = await db.execute(sql`DELETE FROM daily_metric_history`);
        historyAffected =
          (h as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0;
      } catch {
        // History table may not exist yet on a fresh DB.
      }
      const metricsAffected =
        (m as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0;
      return {
        ok: true,
        demoMode: false,
        deletedCount: metricsAffected,
        historyDeletedCount: historyAffected,
      };
    }),
});
