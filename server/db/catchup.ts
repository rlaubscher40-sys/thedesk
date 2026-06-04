/**
 * Idempotent schema catch-up.
 *
 * Production was originally provisioned with `drizzle-kit push`, which never
 * wrote the `__drizzle_migrations` journal. That means the real
 * `drizzle-kit migrate` can't be run against it safely — with no journal it
 * would try to re-apply every migration from 0000 and blow up on the tables
 * that already exist. Until that journal is back-filled, this hand-maintained
 * list is the source of truth for "columns/tables the running code expects".
 *
 * Every statement runs inside its own try/catch and any "already exists"
 * error is swallowed, so the whole thing is safe to re-run on every boot:
 * a freshly migrated DB applies nothing, a stale one applies only the gap.
 *
 * INVARIANT: every `ALTER TABLE … ADD <column>` that appears in
 * `drizzle/*.sql` must have a matching entry here. `catchup.test.ts`
 * enforces this — if it fails, add the missing column below. That test is
 * what stops the class of outage where new code ships expecting a column
 * the database doesn't have yet.
 */
import { sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";

export const CATCHUP_STATEMENTS: Array<{ name: string; sql: string }> = [
  { name: "0001 · users.isPremium", sql: "ALTER TABLE users ADD isPremium boolean NOT NULL DEFAULT false" },
  { name: "0001 · daily_feed_items.imageUrl", sql: "ALTER TABLE daily_feed_items ADD imageUrl text" },
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
    name: "0012 · daily_feed_items.whyItMatters",
    sql: "ALTER TABLE daily_feed_items ADD whyItMatters text",
  },
  {
    name: "0013 · subscribers.lastDailyBriefDate",
    sql: "ALTER TABLE subscribers ADD lastDailyBriefDate varchar(10)",
  },
  {
    name: "0014 · subscribers.lastWeeklyRecapDate",
    sql: "ALTER TABLE subscribers ADD lastWeeklyRecapDate varchar(10)",
  },
  {
    name: "0014 · reading_queue.nudgeSentAt",
    sql: "ALTER TABLE reading_queue ADD nudgeSentAt TIMESTAMP NULL",
  },
  {
    name: "0014 · reading_queue.nudgeResponse",
    sql: "ALTER TABLE reading_queue ADD nudgeResponse varchar(16) NULL",
  },
  {
    name: "0015 · instagram_posts table",
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
  // ── Structure upgrades (drizzle 0016–0018). These shipped without
  //    matching catch-up entries, which left production's full-row SELECTs
  //    throwing on missing columns until they were added by hand. Kept here
  //    so a fresh deploy self-heals.
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
  {
    name: "0019 · daily_feed_items.channel",
    sql: "ALTER TABLE daily_feed_items ADD channel varchar(32) NOT NULL DEFAULT 'AU'",
  },
  {
    name: "0020 · job_runs table",
    sql: `CREATE TABLE job_runs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      jobKey VARCHAR(64) NOT NULL,
      runDate VARCHAR(10) NOT NULL,
      status VARCHAR(16) NOT NULL,
      attempts INT NOT NULL DEFAULT 1,
      detail TEXT,
      startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finishedAt TIMESTAMP NULL,
      UNIQUE KEY uq_job_runs_key_date (jobKey, runDate)
    )`,
  },
];

/** MySQL/TiDB error message fragments that mean "already applied". */
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
export function isHarmless(err: unknown): boolean {
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

export type CatchupReport = {
  applied: string[];
  skipped: string[];
  failed: Array<{ name: string; message: string }>;
};

/**
 * Apply every catch-up statement against the given database. Statements that
 * fail with a harmless "already exists" error are counted as skipped; only
 * genuine errors land in `failed`. Never throws — callers decide what to do
 * with the report.
 */
export async function runCatchup(
  db: MySql2Database<Record<string, unknown>>
): Promise<CatchupReport> {
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
      const cause = (err as { cause?: { sqlMessage?: string; message?: string } }).cause;
      const message =
        cause?.sqlMessage ?? cause?.message ?? (err as Error).message ?? String(err);
      failed.push({ name: stmt.name, message });
    }
  }

  return { applied, skipped, failed };
}
