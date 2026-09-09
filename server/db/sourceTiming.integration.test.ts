import { expect, it } from "vitest";
import { createConnection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { dailyFeedItems } from "./schema";
import { CATCHUP_STATEMENTS } from "./catchup";
import { sourceTimingSchema } from "../../shared/sourceTiming";
const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
it.skipIf(!testUrl)(
  "adds source timing without inventing legacy dates and reads JSON provenance",
  async () => {
    const url = new URL(testUrl!);
    if (
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.pathname !== "/security_audit_test"
    )
      throw new Error("Source timing integration requires the isolated local test database");
    const connection = await createConnection(testUrl!);
    try {
      // Temporary table is private to this connection; other integration tests
      // and their tables are unaffected, even when workers run concurrently.
      await connection.query(
        "CREATE TEMPORARY TABLE daily_feed_items (id INT PRIMARY KEY, feedDate VARCHAR(10) NOT NULL)"
      );
      await connection.query(
        "INSERT INTO daily_feed_items (id, feedDate) VALUES (1, '2026-09-08')"
      );
      const migration = CATCHUP_STATEMENTS.find(
        (item) => item.name === "0026 · daily_feed_items.sourceTiming"
      )!;
      await connection.query(migration.sql);
      const timing = sourceTimingSchema.parse({
        feedReportedAt: "2026-09-09T00:00:00Z",
        publisherPublishedAt: "2026-09-08T00:00:00Z",
        publisherDateStatus: "available",
        retrievedAt: "2026-09-09T00:10:00Z",
      });
      await connection.execute(
        "INSERT INTO daily_feed_items (id, feedDate, sourceTiming) VALUES (?, ?, ?)",
        [2, "2026-09-09", JSON.stringify(timing)]
      );
      const rows = await drizzle(connection)
        .select({ id: dailyFeedItems.id, timing: dailyFeedItems.sourceTiming })
        .from(dailyFeedItems)
        .orderBy(dailyFeedItems.id);
      expect(rows).toEqual([
        { id: 1, timing: null },
        { id: 2, timing },
      ]);
    } finally {
      await connection.end();
    }
  }
);
