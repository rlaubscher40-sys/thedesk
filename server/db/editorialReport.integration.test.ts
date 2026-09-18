import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createPool, type Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { EDITORIAL_VERSION, type EditorialReport } from "../../shared/editorial";
const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
const name = "editorial_report_" + randomUUID().replaceAll("-", "");
let setup: Pool | undefined, pool: Pool | undefined;
let editorial: typeof import("./editorial");
beforeAll(async () => {
  if (!testUrl) return;
  const url = new URL(testUrl);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/security_audit_test")
    throw new Error("Use isolated CI database");
  setup = createPool(testUrl);
  await setup.query(`CREATE DATABASE \`${name}\``);
  url.pathname = "/" + name;
  pool = createPool(url.toString());
  vi.doMock("./client", () => ({ getDb: () => drizzle(pool!) }));
  editorial = await import("./editorial");
  for (const ddl of editorial.EDITORIAL_DDL) await pool.query(ddl.sql);
  await pool.query(
    "CREATE TABLE feed_evidence_fingerprints (createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)"
  );
});
afterAll(async () => {
  await pool?.end();
  if (setup) {
    await setup.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await setup.end();
  }
});
it.skipIf(!testUrl)(
  "reads back every retained decision and source from a large report and verifies an update",
  async () => {
    const stamp = new Date().toISOString();
    const report: EditorialReport = {
      version: EDITORIAL_VERSION,
      runId: randomUUID(),
      startedAt: stamp,
      finishedAt: stamp,
      status: "published",
      discovered: 600,
      evidencePool: 0,
      read: 132,
      selected: 4,
      inserted: 4,
      decisionCount: 600,
      outcomes: { selected: 4, "outside-reading-budget": 596 },
      sources: Array.from({ length: 170 }, (_, n) => ({
        name: `Source ${n}`,
        url: `https://example.test/${n}`,
        fetched: 3,
        error: null,
      })),
      decisions: Array.from({ length: 300 }, (_, n) => ({
        title: `Synthetic decision ${n}`,
        url: `https://example.test/article/${n}`,
        source: "Fixture",
        reason: "outside-reading-budget",
        score: 0,
        selected: false,
        readAttempted: false,
        beat: null,
        textChars: 0,
      })),
    };
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await editorial.recordEditorialReport(report);
      expect((await editorial.editorialHealth())[0]?.report).toEqual(report);
      const updated = { ...report, inserted: 3 };
      await editorial.recordEditorialReport(updated);
      expect((await editorial.editorialHealth())[0]?.report).toEqual(updated);
      expect(log).toHaveBeenCalledWith(expect.stringContaining('"verified":true'));
    } finally {
      log.mockRestore();
    }
  }
);
