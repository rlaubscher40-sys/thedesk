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
 * function is idempotent, re-running it after a partial apply just
 * skips the columns/tables that already exist. The returned report
 * lists which statements ran, which were already present, and any
 * unexpected errors.
 *
 * This is a STOPGAP. Production-correct path is `drizzle-kit migrate`
 * baked into the Railway start command, but that requires journal/
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
  {
    name: "0011 · feedback_submissions table",
    sql: `CREATE TABLE feedback_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      kind VARCHAR(16) NOT NULL,
      message TEXT NOT NULL,
      pageUrl VARCHAR(512),
      userAgent VARCHAR(512),
      contactEmail VARCHAR(320),
      reporterLabel VARCHAR(128),
      status VARCHAR(16) NOT NULL DEFAULT 'new',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    name: "0011 · feedback_submissions index",
    sql: "CREATE INDEX idx_feedback_status_created ON feedback_submissions (status, createdAt)",
  },
  {
    name: "0012 · hero_library table",
    sql: `CREATE TABLE hero_library (
      id INT AUTO_INCREMENT PRIMARY KEY,
      label VARCHAR(128),
      promptUsed TEXT,
      contentType VARCHAR(64) NOT NULL,
      bytes MEDIUMBLOB NOT NULL,
      retired BOOLEAN NOT NULL DEFAULT FALSE,
      lastUsedAt TIMESTAMP NULL,
      usedCount INT NOT NULL DEFAULT 0,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    name: "0012 · hero_library index",
    sql: "CREATE INDEX idx_hero_library_pick ON hero_library (retired, lastUsedAt)",
  },
  {
    name: "0013 · server_errors table",
    sql: `CREATE TABLE server_errors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      occurredAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      level VARCHAR(16) NOT NULL DEFAULT 'error',
      message VARCHAR(512) NOT NULL,
      stack TEXT,
      method VARCHAR(16),
      route VARCHAR(256),
      statusCode INT,
      userAgent VARCHAR(256)
    )`,
  },
  {
    name: "0013 · server_errors index",
    sql: "CREATE INDEX idx_server_errors_recent ON server_errors (occurredAt)",
  },
  {
    name: "0014 · uptime_pings table",
    sql: `CREATE TABLE uptime_pings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pingedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      statusCode INT NOT NULL,
      latencyMs INT NOT NULL,
      source VARCHAR(64) NOT NULL DEFAULT 'external',
      region VARCHAR(32)
    )`,
  },
  {
    name: "0014 · uptime_pings index",
    sql: "CREATE INDEX idx_uptime_pings_recent ON uptime_pings (pingedAt)",
  },
  {
    name: "0015 · page_views table",
    sql: `CREATE TABLE page_views (
      id INT AUTO_INCREMENT PRIMARY KEY,
      viewedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      path VARCHAR(256) NOT NULL,
      referrer VARCHAR(256),
      sessionId VARCHAR(64) NOT NULL
    )`,
  },
  {
    name: "0015 · page_views index by time",
    sql: "CREATE INDEX idx_page_views_recent ON page_views (viewedAt)",
  },
  {
    name: "0015 · page_views index by path",
    sql: "CREATE INDEX idx_page_views_path ON page_views (path, viewedAt)",
  },
  {
    name: "0016 · daily_feed_items.whyItMatters",
    sql: "ALTER TABLE daily_feed_items ADD whyItMatters text",
  },
  {
    name: "0017 · subscribers.lastDailyBriefDate",
    sql: "ALTER TABLE subscribers ADD lastDailyBriefDate varchar(10)",
  },
  {
    name: "0018 · subscribers.lastWeeklyRecapDate",
    sql: "ALTER TABLE subscribers ADD lastWeeklyRecapDate varchar(10)",
  },
  {
    name: "0019 · reading_queue.nudgeSentAt",
    sql: "ALTER TABLE reading_queue ADD nudgeSentAt TIMESTAMP NULL",
  },
  {
    name: "0019 · reading_queue.nudgeResponse",
    sql: "ALTER TABLE reading_queue ADD nudgeResponse varchar(16) NULL",
  },
  {
    name: "0020 · instagram_posts table",
    sql: `CREATE TABLE instagram_posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      mediaId VARCHAR(64) NOT NULL UNIQUE,
      postType VARCHAR(16) NOT NULL,
      feedDate VARCHAR(10),
      editionNumber INT,
      headline VARCHAR(512),
      likes INT,
      comments INT,
      reach INT,
      saved INT,
      shares INT,
      totalInteractions INT,
      metricsFetchedAt TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    name: "0016 · daily_feed_items.counterpoint",
    sql: "ALTER TABLE daily_feed_items ADD counterpoint text",
  },
  {
    name: "0016 · daily_feed_items.corroborationCount",
    sql: "ALTER TABLE daily_feed_items ADD corroborationCount int NOT NULL DEFAULT 1",
  },
  {
    name: "0016 · daily_feed_items.corroboratingSources",
    sql: "ALTER TABLE daily_feed_items ADD corroboratingSources json",
  },
  {
    name: "0017 · editions.lookback",
    sql: "ALTER TABLE editions ADD lookback json",
  },
  {
    name: "0018 · daily_feed_items.threadParentId",
    sql: "ALTER TABLE daily_feed_items ADD threadParentId int",
  },
  {
    name: "0018 · daily_feed_items.threadParentTitle",
    sql: "ALTER TABLE daily_feed_items ADD threadParentTitle text",
  },
];

/** MySQL/TiDB error codes / fragments we treat as "already applied". */
const HARMLESS_ERROR_PATTERNS = [
  /Duplicate column/i,
  /Table .* already exists/i,
  /Duplicate key name/i,
];

/**
 * MySQL/TiDB error codes that mean "already applied". When the underlying
 * mysql2 error is accessible via err.cause we can read these directly,
 * which is more reliable than substring-matching error messages.
 */
const HARMLESS_ERROR_CODES = new Set<string | number>([
  "ER_DUP_FIELDNAME", // 1060, ALTER TABLE ADD column that already exists
  "ER_TABLE_EXISTS_ERROR", // 1050, CREATE TABLE for an existing table
  "ER_DUP_KEYNAME", // 1061, CREATE INDEX for an existing index
  1060,
  1050,
  1061,
]);

/**
 * Walk an error and any nested `.cause` chain looking for either a
 * known-harmless error code or text on any layer that matches one of
 * the harmless message patterns. Drizzle wraps the original mysql2
 * error inside a `Failed query: …` outer error, so the helpful text
 * lives on `err.cause` not `err.message`.
 */
function isHarmless(err: unknown): boolean {
  const seen = new Set<unknown>();
  let cursor: unknown = err;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const layer = cursor as {
      message?: string;
      code?: string | number;
      errno?: number;
      sqlMessage?: string;
      cause?: unknown;
    };
    if (layer.code !== undefined && HARMLESS_ERROR_CODES.has(layer.code)) return true;
    if (layer.errno !== undefined && HARMLESS_ERROR_CODES.has(layer.errno)) return true;
    const text = `${layer.message ?? ""} ${layer.sqlMessage ?? ""}`;
    if (text.trim().length > 0 && HARMLESS_ERROR_PATTERNS.some((p) => p.test(text))) {
      return true;
    }
    cursor = layer.cause;
  }
  return false;
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
        if (isHarmless(err)) {
          skipped.push(stmt.name);
          continue;
        }
        // Genuine failure, surface the most informative message we can
        // reach: the underlying SQL error wins over Drizzle's wrapper.
        const cause = (err as { cause?: { sqlMessage?: string; message?: string } })
          .cause;
        const message =
          cause?.sqlMessage ??
          cause?.message ??
          (err as Error).message ??
          String(err);
        failed.push({ name: stmt.name, message });
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
