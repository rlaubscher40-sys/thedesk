/**
 * Daily-metrics query helpers. Upsert by metricKey so the ingest workflow
 * can call once per metric without worrying about insert-vs-update.
 */
import { asc, eq } from "drizzle-orm";
import * as demoQueries from "../demo/queries";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import {
  dailyMetrics,
  type DailyMetric,
  type InsertDailyMetric,
} from "./schema";

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
        asOf: row.asOf,
        displayOrder: row.displayOrder,
        previousValue,
      })
      .where(eq(dailyMetrics.metricKey, input.metricKey));
  } else {
    await db.insert(dailyMetrics).values(row);
  }
}
