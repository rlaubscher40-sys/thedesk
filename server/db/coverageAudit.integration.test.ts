import { expect, it, vi } from "vitest";
import { createConnection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { dailyFeedItems } from "./schema";
const fixture = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("./client", () => ({ getDb: () => fixture.db }));
import { repairCoverageAudit } from "./editorial";
const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
it.skipIf(!testUrl)(
  "repairs published angles and relationships idempotently without overwriting editorial notes",
  async () => {
    const url = new URL(testUrl!);
    if (
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.pathname !== "/security_audit_test"
    )
      throw new Error("Isolated local test database required");
    const connection = await createConnection(testUrl!);
    try {
      await connection.query(`CREATE TEMPORARY TABLE daily_feed_items (
   id INT PRIMARY KEY, title VARCHAR(512), summary TEXT, channel VARCHAR(32), feedDate VARCHAR(10), sourceUrl TEXT,
   sourceTiming JSON, threadParentId INT, threadParentTitle TEXT, partnerTag TEXT, sayThis TEXT,
   whyItMatters TEXT, counterpoint TEXT, rubensNote TEXT, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
      const db = drizzle(connection);
      fixture.db = db;
      const now = new Date("2026-09-11T11:00:00Z");
      const timing = {
        feedReportedAt: null,
        publisherPublishedAt: null,
        publisherPublishedDay: "2026-09-11",
        publisherDateStatus: "available",
        retrievedAt: now.toISOString(),
      };
      const rows = [
        [
          1,
          "Updated modelling: housing package cuts 10,700 homes",
          "Watching: if supply falls by mid-2026, act.",
          null,
          "PROPERTY",
        ],
        [
          2,
          "Housing reforms to slash 10,700 homes",
          "Watching: if approvals change by late-2026, review.",
          null,
          "AU",
        ],
        [3, "Housing reforms to slash 10,700 homes", null, 99, "PROPERTY"],
        [
          4,
          "Housing reforms to slash 10,700 homes",
          "Watching: if supply falls by mid-2026, act.",
          null,
          "HOLD",
        ],
      ];
      for (const [id, title, tag, parent, channel] of rows)
        await connection.execute(
          "INSERT INTO daily_feed_items (id,title,summary,feedDate,channel,sourceTiming,partnerTag,threadParentId,rubensNote) VALUES (?,?,'Publisher report','2026-09-11',?,?,?,?, 'Keep my editorial note')",
          [id, title, channel, JSON.stringify(timing), tag, parent]
        );
      await repairCoverageAudit(now);
      const read = () =>
        db
          .select({
            id: dailyFeedItems.id,
            tag: dailyFeedItems.partnerTag,
            parent: dailyFeedItems.threadParentId,
            note: dailyFeedItems.rubensNote,
          })
          .from(dailyFeedItems)
          .orderBy(dailyFeedItems.id);
      const first = await read();
      expect(first[0]).toMatchObject({ tag: null, parent: null, note: "Keep my editorial note" });
      expect(first[1]).toMatchObject({ parent: 1, tag: rows[1]![2] });
      expect(first[2]!.parent).toBe(99);
      expect(first[3]).toMatchObject({ parent: null, tag: rows[3]![2] });
      await repairCoverageAudit(now);
      expect(await read()).toEqual(first);
      await db
        .update(dailyFeedItems)
        .set({ partnerTag: "An editor corrected this." })
        .where(eq(dailyFeedItems.id, 1));
      await repairCoverageAudit(now);
      expect((await read())[0]!.tag).toBe("An editor corrected this.");
    } finally {
      fixture.db = null;
      await connection.end();
    }
  }
);
