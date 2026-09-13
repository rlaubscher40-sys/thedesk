import { desc, gte, lt } from "drizzle-orm";
import { getDb } from "./client";
import { isDemoMode } from "../demo/store";
import { webVitals } from "./schema";
import { analyticsPath } from "../../shared/analyticsPath";
import { summariseVitals, webVitalSchema } from "../../shared/webVitals";
import type { z } from "zod";
export const WEB_VITALS_DDL = {
  name: "ui-audit · web_vitals",
  sql: `CREATE TABLE IF NOT EXISTS web_vitals (id VARCHAR(100) PRIMARY KEY, name VARCHAR(8) NOT NULL, value DOUBLE NOT NULL, path VARCHAR(256) NOT NULL, device VARCHAR(8) NOT NULL, recordedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_vitals_recorded (recordedAt))`,
};
export async function recordWebVital(input: z.infer<typeof webVitalSchema>) {
  const db = getDb();
  if (!db || isDemoMode()) return;
  const data = { ...input, path: analyticsPath(input.path) };
  await db
    .insert(webVitals)
    .values(data)
    .onDuplicateKeyUpdate({ set: { value: data.value } });
  // Bounded retention, without keeping visitor or account identifiers.
  await db.delete(webVitals).where(lt(webVitals.recordedAt, new Date(Date.now() - 30 * 86400000)));
}
export async function webVitalSummary() {
  const db = getDb();
  if (!db || isDemoMode()) return { available: false, rows: summariseVitals([]), capped: false };
  const rows = await db
    .select()
    .from(webVitals)
    .where(gte(webVitals.recordedAt, new Date(Date.now() - 7 * 86400000)))
    .orderBy(desc(webVitals.recordedAt))
    .limit(5001);
  return {
    available: true,
    rows: summariseVitals(rows.slice(0, 5000)),
    capped: rows.length > 5000,
  };
}
