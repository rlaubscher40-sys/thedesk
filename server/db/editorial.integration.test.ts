import { expect, it } from "vitest";
import { createConnection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { EDITORIAL_DDL, editorialRuns } from "./editorial";
import { editorialReportSchema, EDITORIAL_VERSION } from "../../shared/editorial";
const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
it.skipIf(!testUrl)(
  "persists and updates an editorial report in the migrated MySQL table",
  async () => {
    const url = new URL(testUrl!);
    if (
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.pathname !== "/security_audit_test"
    )
      throw new Error("Editorial integration requires the isolated local test database");
    const connection = await createConnection(testUrl!);
    try {
      await connection.query(
        EDITORIAL_DDL[0]!.sql.replace("CREATE TABLE", "CREATE TEMPORARY TABLE")
      );
      const db = drizzle(connection);
      const report = editorialReportSchema.parse({
        version: EDITORIAL_VERSION,
        runId: "64bf5bd2-6172-42e5-a06d-c4f7cc54e329",
        startedAt: "2026-09-10T01:00:00Z",
        finishedAt: "2026-09-10T01:01:00Z",
        status: "preview",
        discovered: 25,
        evidencePool: 3,
        read: 12,
        selected: 4,
        inserted: 0,
        sources: [],
        decisions: [],
      });
      await db.insert(editorialRuns).values({ id: report.runId, report });
      const published = { ...report, status: "published" as const, inserted: 4 };
      await db
        .insert(editorialRuns)
        .values({ id: report.runId, report: published })
        .onDuplicateKeyUpdate({ set: { report: published } });
      const rows = await db.select().from(editorialRuns);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.report).toEqual(published);
      expect(rows[0]!.createdAt).toBeInstanceOf(Date);
    } finally {
      await connection.end();
    }
  }
);
