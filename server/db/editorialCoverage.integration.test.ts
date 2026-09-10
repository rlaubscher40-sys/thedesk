import { expect, it } from "vitest";
import { createConnection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import {
  COVERAGE_DDL,
  editorialCoverageDays,
  readCoverage,
  saveCoverage,
} from "./editorialCoverage";
import { EDITORIAL_DDL } from "./editorial";
import { coverageExamples } from "../../shared/editorialCoverageExamples";
const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
it.skipIf(!testUrl)(
  "persists daily reviews, rejects concurrent overwrites, and compares actual publication",
  async () => {
    const url = new URL(testUrl!);
    if (
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.pathname !== "/security_audit_test"
    )
      throw new Error("Coverage integration requires the isolated local test database");
    const connection = await createConnection(testUrl!);
    try {
      await connection.query(
        COVERAGE_DDL[0]!.sql.replace("CREATE TABLE", "CREATE TEMPORARY TABLE")
      );
      await connection.query(
        EDITORIAL_DDL[0]!.sql.replace("CREATE TABLE", "CREATE TEMPORARY TABLE")
      );
      await connection.query(
        "CREATE TEMPORARY TABLE daily_feed_items (id INT PRIMARY KEY, title TEXT, sourceUrl TEXT, channel VARCHAR(32), feedDate VARCHAR(10), createdAt TIMESTAMP)"
      );
      const db = drizzle(connection),
        day = "2026-09-10",
        entries = coverageExamples(day);
      const read = () => readCoverage(day, db, new Date("2026-09-11T00:00:00Z"));
      expect((await read()).reviewed).toBe(0);
      expect((await saveCoverage({ day, version: 0, entries }, 7, db)).version).toBe(1);
      await expect(saveCoverage({ day, version: 0, entries: [] }, 8, db)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      const reviewed = entries.map((e) => ({ ...e, reviewed: true }));
      await saveCoverage({ day, version: 1, entries: reviewed }, 7, db);
      await expect(saveCoverage({ day, version: 1, entries: [] }, 8, db)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      await connection.query(
        "INSERT INTO daily_feed_items VALUES (1,?,?,'PROPERTY',?,'2026-09-10 00:00:00')",
        [entries[0]!.title, entries[0]!.urls[0], day]
      );
      const result = await read();
      expect(result.reviewed).toBe(3);
      expect(result.confirmed).toBe(1);
      expect(result.unknown).toBe(2);
      const saved = await db.select().from(editorialCoverageDays);
      expect(saved[0]!.updatedBy).toBe(7);
      expect(saved[0]!.version).toBe(2);
      await saveCoverage({ day, version: 2, entries: [] }, 7, db);
      expect((await read()).rows).toEqual([]); // Explicit empty review stays empty; examples do not reappear.
    } finally {
      await connection.end();
    }
  }
);
