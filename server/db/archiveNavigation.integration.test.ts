import { expect, it, vi } from "vitest";
import { createConnection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
const fixture = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("./client", () => ({ getDb: () => fixture.db }));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
import { getCategoryHeat, getFeedItemsByCategory, searchAllContent } from "./feed";
import type { ArchiveCursor } from "../../shared/archiveScope";
const testUrl = process.env.SECURITY_TEST_DATABASE_URL;

it("reports unavailable storage instead of inventing empty archives or search results", async () => {
  await expect(getFeedItemsByCategory("PROPERTY")).rejects.toThrow(/unavailable/);
  await expect(searchAllContent("needle")).rejects.toThrow(/unavailable/);
  await expect(getCategoryHeat(3650, { region: "AU" })).rejects.toThrow(/unavailable/);
});

it.skipIf(!testUrl)(
  "ranks before the cap, escapes literal queries and pages all local records without overlap",
  async () => {
    const url = new URL(testUrl!);
    if (
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      url.pathname !== "/security_audit_test"
    )
      throw new Error("Isolated local test database required");
    const connection = await createConnection(testUrl!);
    try {
      fixture.db = drizzle(connection);
      await connection.query(`CREATE TEMPORARY TABLE daily_feed_items (
      id INT PRIMARY KEY,sourceTiming JSON,feedDate VARCHAR(10),title VARCHAR(512),source VARCHAR(256),sourceUrl TEXT,
      summary TEXT,category VARCHAR(64),channel VARCHAR(32),imageUrl TEXT,partnerTag TEXT,sayThis TEXT,
      whyItMatters TEXT,counterpoint TEXT,corroborationCount INT,corroboratingSources JSON,threadParentId INT,
      threadParentTitle TEXT,rubensNote TEXT,priority INT,promotedToEdition BOOLEAN,createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
      const insert = async (id: number, title: string, channel = "AU", feedDate = "2026-09-18") => {
        await connection.query("INSERT INTO daily_feed_items SET ?", {
          id,
          title,
          channel,
          feedDate,
          category: "PROPERTY",
          summary: "Reporting mentions needle",
          source: "Test publisher",
        });
      };
      await insert(1, "Needle", "AU", "2026-09-01");
      for (let id = 100; id < 160; id++) await insert(id, `Housing report ${id}`);
      await insert(200, "Needle", "HOLD");
      await insert(201, "Needle", "GLOBAL");
      const options = { category: "PROPERTY", region: "AU" as const };
      const relevant = await searchAllContent("needle", options);
      expect(relevant.feedItems).toHaveLength(50);
      expect(relevant.feedItems[0]!.id).toBe(1);
      expect(relevant.feedItems.some((row) => row.id >= 200)).toBe(false);
      const latest = await searchAllContent("needle", { ...options, sort: "latest" });
      expect(latest.feedItems[0]!.id).toBe(159);
      expect(latest.feedItems.some((row) => row.id === 1)).toBe(false);

      const seen: number[] = [];
      let before: ArchiveCursor | undefined;
      for (let page = 0; page < 10; page++) {
        const rows = await getFeedItemsByCategory("PROPERTY", 10, { region: "AU", before });
        if (!rows.length) break;
        seen.push(...rows.map((row) => row.id));
        const last = rows.at(-1)!;
        before = { feedDate: last.feedDate, id: last.id };
        // New collection during browsing must not repeat or displace older rows.
        if (page === 0) await insert(300, "New report");
      }
      expect(seen).toHaveLength(61);
      expect(new Set(seen).size).toBe(61);
      expect(seen.at(-1)).toBe(1);
      expect(seen.some((id) => id >= 200)).toBe(false);
      expect(
        (await getFeedItemsByCategory("PROPERTY", 100, { region: "AU", since: "2026-09-18" })).some(
          (row) => row.id === 1
        )
      ).toBe(false);
      await insert(400, "10% deposit");
      await insert(401, "100 deposit");
      expect((await searchAllContent("10%", options)).feedItems.map((row) => row.id)).toEqual([
        400,
      ]);
    } finally {
      fixture.db = null;
      await connection.end();
    }
  }
);
