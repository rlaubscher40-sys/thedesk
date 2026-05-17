import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { isDemoMode } from "../demo/store";
import { adminProcedure, publicProcedure, router } from "../core/trpc";

/**
 * System endpoints. demoMode is public; the maintenance helpers are admin-
 * only and exist so the editor can run one-off DB chores (migrations,
 * cleanup) from the admin panel without opening a SQL editor.
 */

/**
 * Catch-up migrations. Each statement runs inside a try/catch so the
 * function is idempotent — re-running it after a partial apply just
 * skips the columns/tables that already exist. The returned report
 * lists which statements ran, which were already present, and any
 * unexpected errors.
 *
 * This is a STOPGAP. Production-correct path is `drizzle-kit migrate`
 * baked into the Railway start command — but that requires journal/
 * state alignment work. This button lets the editor catch up from
 * mobile without that.
 */
const CATCHUP_STATEMENTS: Array<{ name: string; sql: string }> = [
  { name: "0004 · daily_feed_items.rubensNote", sql: "ALTER TABLE daily_feed_items ADD rubensNote text" },
  { name: "0005 · editions.marketStress", sql: "ALTER TABLE editions ADD marketStress varchar(16)" },
  { name: "0005 · editions.datesToWatch", sql: "ALTER TABLE editions ADD datesToWatch json" },
  { name: "0005 · daily_metrics.context", sql: "ALTER TABLE daily_metrics ADD context varchar(256)" },
  { name: "0005 · daily_metrics.groupKey", sql: "ALTER TABLE daily_metrics ADD groupKey varchar(32)" },
  {
    name: "0006 · daily_metric_history table",
    sql: `CREATE TABLE daily_metric_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      metricKey VARCHAR(64) NOT NULL,
      numericValue DOUBLE NOT NULL,
      recordedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    name: "0006 · daily_metric_history index",
    sql: "CREATE INDEX idx_metric_history_key_recorded ON daily_metric_history (metricKey, recordedAt)",
  },
  { name: "0007 · editions.metaTitle", sql: "ALTER TABLE editions ADD metaTitle varchar(160)" },
  { name: "0007 · editions.metaDescription", sql: "ALTER TABLE editions ADD metaDescription varchar(320)" },
  { name: "0007 · editions.socialTitle", sql: "ALTER TABLE editions ADD socialTitle varchar(200)" },
  { name: "0007 · editions.socialDescription", sql: "ALTER TABLE editions ADD socialDescription varchar(400)" },
  { name: "0007 · editions.headlineVariants", sql: "ALTER TABLE editions ADD headlineVariants json" },
  {
    name: "0008 · edition_assets table",
    sql: `CREATE TABLE edition_assets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      editionId INT NOT NULL,
      kind VARCHAR(32) NOT NULL,
      contentType VARCHAR(64) NOT NULL,
      bytes MEDIUMBLOB NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    name: "0008 · edition_assets index",
    sql: "CREATE INDEX idx_edition_assets_lookup ON edition_assets (editionId, kind, createdAt)",
  },
  {
    name: "0009 · daily_metrics.sourceUrl",
    sql: "ALTER TABLE daily_metrics ADD sourceUrl text",
  },
  {
    name: "0010 · daily_feed_items.priority",
    sql: "ALTER TABLE daily_feed_items ADD priority int NOT NULL DEFAULT 50",
  },
];

/** MySQL/TiDB error codes / fragments we treat as "already applied". */
const HARMLESS_ERROR_PATTERNS = [
  /Duplicate column/i,
  /Table .* already exists/i,
  /Duplicate key name/i,
  /1060/, // ER_DUP_FIELDNAME
  /1050/, // ER_TABLE_EXISTS_ERROR
  /1061/, // ER_DUP_KEYNAME
];

function isHarmless(message: string): boolean {
  return HARMLESS_ERROR_PATTERNS.some((p) => p.test(message));
}

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

    const applied: string[] = [];
    const skipped: string[] = [];
    const failed: Array<{ name: string; message: string }> = [];

    for (const stmt of CATCHUP_STATEMENTS) {
      try {
        await db.execute(sql.raw(stmt.sql));
        applied.push(stmt.name);
      } catch (err) {
        const message = (err as Error).message ?? String(err);
        if (isHarmless(message)) {
          skipped.push(stmt.name);
        } else {
          failed.push({ name: stmt.name, message });
        }
      }
    }

    return {
      ok: failed.length === 0,
      demoMode: false,
      applied,
      skipped,
      failed,
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
   * accidental fires from the typed-client perspective — the UI passes
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
