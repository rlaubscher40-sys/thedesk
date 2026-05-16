/**
 * Daily-metrics query helpers. Upsert by metricKey so the ingest workflow
 * can call once per metric without worrying about insert-vs-update.
 */
import { asc, eq, gte } from "drizzle-orm";
import * as demoQueries from "../demo/queries";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import {
  dailyMetricHistory,
  dailyMetrics,
  type DailyMetric,
  type InsertDailyMetric,
} from "./schema";

/**
 * Parse a display value like "8,210.43" / "0.6543" / "$815,439" / "4.35"
 * to a JS number. Returns null when the string can't be interpreted —
 * the history insert is skipped in that case.
 */
function parseNumeric(raw: string): number | null {
  const cleaned = raw.replace(/[$,%\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export async function listDailyMetrics(): Promise<DailyMetric[]> {
  if (isDemoMode()) return demoQueries.listDailyMetrics();
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(dailyMetrics)
    .orderBy(asc(dailyMetrics.displayOrder));
}

/**
 * Upsert a metric by `metricKey`. If a row already exists, its current
 * `value` becomes the new `previousValue` so the UI can render the delta.
 */
export async function upsertDailyMetric(input: {
  metricKey: string;
  label: string;
  value: string;
  unit?: string | null;
  source?: string | null;
  context?: string | null;
  groupKey?: string | null;
  asOf: Date;
  displayOrder?: number;
}): Promise<void> {
  if (isDemoMode()) return demoQueries.upsertDailyMetric(input);
  const db = getDb();
  if (!db) return;

  const existing = await db
    .select()
    .from(dailyMetrics)
    .where(eq(dailyMetrics.metricKey, input.metricKey))
    .limit(1);

  const previousValue = existing[0]?.value ?? null;

  const row: InsertDailyMetric = {
    metricKey: input.metricKey,
    label: input.label,
    value: input.value,
    unit: input.unit ?? null,
    source: input.source ?? null,
    context: input.context ?? null,
    groupKey: input.groupKey ?? null,
    asOf: input.asOf,
    displayOrder: input.displayOrder ?? 100,
    previousValue,
  };

  if (existing[0]) {
    await db
      .update(dailyMetrics)
      .set({
        label: row.label,
        value: row.value,
        unit: row.unit,
        source: row.source,
        context: row.context,
        groupKey: row.groupKey,
        asOf: row.asOf,
        displayOrder: row.displayOrder,
        previousValue,
      })
      .where(eq(dailyMetrics.metricKey, input.metricKey));
  } else {
    await db.insert(dailyMetrics).values(row);
  }

  // Append the numeric value to the history table so the dashboard can
  // render sparklines. Best-effort — non-numeric values (very rare) are
  // skipped silently.
  const numericValue = parseNumeric(input.value);
  if (numericValue !== null) {
    try {
      await db.insert(dailyMetricHistory).values({
        metricKey: input.metricKey,
        numericValue,
        recordedAt: input.asOf,
      });
    } catch (err) {
      console.warn(
        `[metrics] history insert failed for ${input.metricKey}:`,
        (err as Error).message
      );
    }
  }
}

/**
 * Return the last `days` of numeric history for every metric, keyed by
 * metricKey. Empty arrays are omitted so callers can `?.length` safely.
 */
export async function listMetricHistories(
  days = 30
): Promise<Record<string, Array<{ value: number; recordedAt: Date }>>> {
  if (isDemoMode()) return demoQueries.listMetricHistories?.(days) ?? {};
  const db = getDb();
  if (!db) return {};
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(dailyMetricHistory)
    .where(gte(dailyMetricHistory.recordedAt, since))
    .orderBy(asc(dailyMetricHistory.recordedAt));
  const out: Record<string, Array<{ value: number; recordedAt: Date }>> = {};
  for (const row of rows) {
    (out[row.metricKey] ??= []).push({
      value: row.numericValue,
      recordedAt: row.recordedAt,
    });
  }
  return out;
}

