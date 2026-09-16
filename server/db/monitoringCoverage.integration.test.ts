import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createPool, type Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
const databaseName = "monitoring_test_" + randomUUID().replaceAll("-", "");
let setup: Pool | undefined, pool: Pool | undefined;
let read: typeof import("./health").uptimeMonitoringCoverage;
const now = new Date("2026-09-16T12:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
beforeAll(async () => {
  if (!testUrl) return;
  const url = new URL(testUrl);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/security_audit_test")
    throw new Error("Monitoring tests require the isolated local CI database");
  setup = createPool(testUrl);
  await setup.query(`CREATE DATABASE \`${databaseName}\``);
  url.pathname = "/" + databaseName;
  pool = createPool(url.toString());
  await pool.query(
    "CREATE TABLE uptime_pings (id INT AUTO_INCREMENT PRIMARY KEY, pingedAt TIMESTAMP(3) NOT NULL)"
  );
  vi.doMock("./client", () => ({ getDb: () => drizzle(pool!) }));
  vi.doMock("../demo/store", () => ({ isDemoMode: () => false }));
  read = (await import("./health")).uptimeMonitoringCoverage;
});
afterAll(async () => {
  await pool?.end();
  if (setup) {
    await setup.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    await setup.end();
  }
});
it.skipIf(!testUrl)(
  "aggregates all time buckets without retry inflation or truncating the day",
  async () => {
    expect(await read(now)).toMatchObject({ observedIntervals: 0, longestGapMinutes: 1440 });
    await pool!.query("INSERT INTO uptime_pings (pingedAt) VALUES ?", [
      Array.from({ length: 500 }, () => [ago(1)]),
    ]);
    expect(await read(now)).toMatchObject({
      observedIntervals: 1,
      sparse: true,
      longestGapMinutes: 1439,
    });
    await pool!.query("INSERT INTO uptime_pings (pingedAt) VALUES ?", [
      Array.from({ length: 288 }, (_, i) => [ago(i * 5 + 1)]),
    ]);
    // Invalid-window records cannot make coverage look fresher or wider.
    await pool!.query("INSERT INTO uptime_pings (pingedAt) VALUES ?", [[[ago(-10)], [ago(1500)]]]);
    expect(await read(now)).toMatchObject({
      observedIntervals: 288,
      coveragePercent: 100,
      sparse: false,
      longestGapMinutes: 5,
    });
    await pool!.query("DELETE FROM uptime_pings WHERE pingedAt BETWEEN ? AND ?", [
      ago(551),
      ago(501),
    ]);
    expect(await read(now)).toMatchObject({
      sparse: false,
      stale: false,
      longestGapMinutes: 60,
      hasLongGap: true,
    });
  }
);
