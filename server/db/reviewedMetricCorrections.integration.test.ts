import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createPool, type Pool, type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { REVIEWED_METRIC_CORRECTIONS } from "../../shared/reviewedMetricCorrections";
const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
const databaseName = "metric_corrections_" + randomUUID().replaceAll("-", "");
let setup: Pool | undefined, pool: Pool | undefined;
let apply: typeof import("./reviewedMetricCorrections").applyReviewedMetricCorrections;
beforeAll(async () => {
  if (!testUrl) return;
  const url = new URL(testUrl);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/security_audit_test")
    throw new Error("Requires isolated CI database");
  setup = createPool(testUrl);
  await setup.query(`CREATE DATABASE \`${databaseName}\``);
  url.pathname = "/" + databaseName;
  pool = createPool(url.toString());
  await pool.query(
    "CREATE TABLE daily_metrics (metricKey VARCHAR(100) PRIMARY KEY, asOf DATETIME, value TEXT, context TEXT, source TEXT, sourceUrl TEXT, previousValue TEXT, updatedAt DATETIME)"
  );
  vi.doMock("./client", () => ({ getDb: () => drizzle(pool!) }));
  apply = (await import("./reviewedMetricCorrections")).applyReviewedMetricCorrections;
});
afterAll(async () => {
  await pool?.end();
  if (setup) {
    await setup.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    await setup.end();
  }
});
it.skipIf(!testUrl)(
  "corrects reviewed rows once, preserves dates and refuses later/different source observations",
  async () => {
    for (const c of REVIEWED_METRIC_CORRECTIONS) {
      const original = {
        metricKey: c.metricKey,
        asOf: new Date(c.asOf),
        ...c.before,
        source: "ABS",
        sourceUrl: c.sourceUrl,
        previousValue: "old",
        updatedAt: new Date("2026-09-17T08:05:35Z"),
      };
      await pool!.query("INSERT INTO daily_metrics SET ?", original);
      await apply();
      await apply();
      let [rows] = await pool!.query<RowDataPacket[]>(
        "SELECT * FROM daily_metrics WHERE metricKey=?",
        [c.metricKey]
      );
      expect(rows[0]!.value).toBe(c.after.value);
      expect(rows[0]!.context).toBe(c.after.context);
      expect(rows[0]!.previousValue).toBeNull();
      expect(rows[0]!.asOf.toISOString()).toBe(c.asOf);
      expect(rows[0]!.updatedAt.toISOString()).toBe("2026-09-17T08:05:35.000Z");
      for (const change of [
        { value: "99" },
        { context: "Later editor correction" },
        { sourceUrl: c.sourceUrl.toUpperCase() },
        { asOf: new Date("2026-09-01Z") },
        { source: "Other" },
      ]) {
        await pool!.query("UPDATE daily_metrics SET ? WHERE metricKey=?", [
          { ...original, ...change },
          c.metricKey,
        ]);
        await apply();
        [rows] = await pool!.query<RowDataPacket[]>(
          "SELECT * FROM daily_metrics WHERE metricKey=?",
          [c.metricKey]
        );
        expect(rows[0]!.value).toBe("value" in change ? change.value : c.before.value);
        expect(rows[0]!.previousValue).toBe("old");
      }
    }
  }
);
