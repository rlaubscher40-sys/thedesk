import { expect, it, vi } from "vitest";
import { createConnection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
const fixture = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("./client", () => ({ getDb: () => fixture.db }));
import { repairEditorialReferences } from "./editorial";
const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
it.skipIf(!testUrl)(
  "quarantines non-news formats across lanes without applying Australian subject rules globally",
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
      await c.query(
        `CREATE TEMPORARY TABLE daily_feed_items (id INT PRIMARY KEY,title VARCHAR(512),summary TEXT,source VARCHAR(256),sourceUrl TEXT,category VARCHAR(64),channel VARCHAR(32),feedDate VARCHAR(10),priority INT,rubensNote TEXT,createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`
      );
      const rows = [
        [1, "First home buyer scores historic cottage despite $60,000 higher bid", "AU"],
        [2, "Book your exhibit table at an industry conference", "TECH"],
        [3, "Passenger train derails in France", "GLOBAL"],
        [4, "First home buyers win expanded deposit guarantee", "AU"],
        [5, "AI company launches a new model at industry conference", "TECH"],
        [6, "First home buyer scores historic cottage despite $60,000 higher bid", "HOLD"],
      ];
      for (const [id, title, channel] of rows)
        await c.execute(
          "INSERT INTO daily_feed_items (id,title,summary,source,sourceUrl,category,channel,feedDate,priority,rubensNote) VALUES (?,?,'Source reporting','ABC','https://www.abc.net.au/news/report','POLICY',?,DATE_FORMAT(UTC_TIMESTAMP(),'%Y-%m-%d'),80,'Keep my note')",
          [id, title, channel]
        );
      expect(await repairEditorialReferences()).toBe(2);
      const [result] = await c.query(
        "SELECT id,channel,rubensNote FROM daily_feed_items ORDER BY id"
      );
      expect((result as any[]).map((r) => r.channel)).toEqual([
        "HOLD",
        "HOLD",
        "GLOBAL",
        "AU",
        "TECH",
        "HOLD",
      ]);
      expect((result as any[]).every((r) => r.rubensNote === "Keep my note")).toBe(true);
      expect(await repairEditorialReferences()).toBe(0);
    } finally {
      fixture.db = null;
      await c.end();
    }
  }
);
