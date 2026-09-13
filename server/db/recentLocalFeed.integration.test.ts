import { expect, it, vi } from "vitest";
import { createConnection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
const fixture = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("./client", () => ({ getDb: () => fixture.db }));
import { listRecentLocalFeed } from "./feed";
const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
it.skipIf(!testUrl)(
  "filters prior local days before the limit, retaining dates and excluding held/future rows",
  async () => {
    const url = new URL(testUrl!);
    if (
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.pathname !== "/security_audit_test"
    )
      throw new Error("Isolated local test database required");
    const c = await createConnection(testUrl!);
    try {
      fixture.db = drizzle(c);
      await c.query(`CREATE TEMPORARY TABLE daily_feed_items (id INT PRIMARY KEY,title VARCHAR(512),
      summary TEXT,source VARCHAR(256),category VARCHAR(64),channel VARCHAR(32),feedDate VARCHAR(10),
      priority INT,threadParentId INT,sourceTiming JSON)`);
      const rows: Array<[number, string, string]> = [
        [1, "PROPERTY", "2026-09-12"],
        [2, "PROPERTY", "2026-09-10"],
        [3, "PROPERTY", "2026-09-09"],
        [4, "PROPERTY", "2026-09-13"],
        [5, "PROPERTY", "2026-09-14"],
        [6, "HOLD", "2026-09-12"],
        [7, "AU", "2026-09-12"],
        ...Array.from({ length: 30 }, (_, i): [number, string, string] => [
          100 + i,
          "GLOBAL",
          "2026-09-12",
        ]),
      ];
      for (const [id, channel, date] of rows)
        await c.execute(
          "INSERT INTO daily_feed_items VALUES (?, 'Original headline', 'Reporting', 'Publisher', 'PROPERTY', ?, ?, 80, NULL, NULL)",
          [id, channel, date]
        );
      const local = await listRecentLocalFeed("PROPERTY", "2026-09-13");
      expect(local.map((row) => [row.id, row.feedDate])).toEqual([
        [1, "2026-09-12"],
        [2, "2026-09-10"],
      ]);
      expect((await listRecentLocalFeed("AU", "2026-09-13")).map((row) => row.id)).toEqual([7]);
    } finally {
      fixture.db = null;
      await c.end();
    }
  }
);
