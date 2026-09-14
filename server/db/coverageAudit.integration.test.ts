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
      await connection.query(
        `CREATE TEMPORARY TABLE feed_evidence_fingerprints (feedItemId INT PRIMARY KEY, fingerprint JSON NOT NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`
      );
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
      await connection.execute("UPDATE daily_feed_items SET sourceUrl=? WHERE id=1", [
        "https://masterbuilders.com.au/joint-statement-updated-modelling-housing-package-estimated-to-cut-10700-homes-and-push-rents-higher/",
      ]);
      await connection.execute(
        "INSERT INTO daily_feed_items (id,title,summary,feedDate,channel,sourceUrl) VALUES (5,'SMSF property ban to axe 2,000 homes','Supplementary analysis','2026-09-11','PROPERTY',?)",
        [
          "https://www.brokernews.com.au/news/breaking-news/smsf-property-ban-to-axe-2000-homes-lift-rents-modelling-289959.aspx",
        ]
      );
      await connection.execute(
        "INSERT INTO daily_feed_items (id,title,summary,feedDate,channel,sourceUrl,counterpoint) VALUES (6,'APRA retirement reporting','Official consultation','2026-09-10','AU',?,?)",
        [
          "https://www.apra.gov.au/news-and-publications/apra-revises-proposals-implement-governments-retirement-reporting-framework",
          "Streamlined reporting and a new practice guide still leave funds two years before data collection even begins, plenty of time for the framework to be softened further.",
        ]
      );
      await connection.execute(
        "INSERT INTO daily_feed_items (id,title,summary,feedDate,channel,sourceUrl) VALUES (7,'Investor exits hit record high','PIPA survey','2026-09-11','AU',?),(8,'Property owners reconsider tax changes','PIPA survey','2026-09-11','AU',?)",
        [
          "https://www.brokernews.com.au/news/breaking-news/investor-exits-hit-record-high-as-negative-gearing-and-cgt-reforms-bite-289958.aspx",
          "https://www.mpamag.com/au/news/general/property-investors-head-for-the-exit-as-tax-reforms-bite/589408",
        ]
      );
      await connection.execute(
        "UPDATE daily_feed_items SET whyItMatters=?, rubensNote='Keep APRA note' WHERE id=6",
        [
          "From 2028, Australians will for the first time have published data on how super funds are supporting members through retirement, shifting accountability in a system holding $9.8 trillion.",
        ]
      );
      await repairCoverageAudit(now);
      const read = () =>
        db
          .select({
            id: dailyFeedItems.id,
            tag: dailyFeedItems.partnerTag,
            parent: dailyFeedItems.threadParentId,
            note: dailyFeedItems.rubensNote,
            counterpoint: dailyFeedItems.counterpoint,
            whyItMatters: dailyFeedItems.whyItMatters,
          })
          .from(dailyFeedItems)
          .orderBy(dailyFeedItems.id);
      const first = await read();
      expect(first[5]!.counterpoint).toContain("late 2027");
      expect(first[5]!.whyItMatters).toContain("expecting initial publication in 2028");
      expect(first[5]!.whyItMatters).not.toContain("9.8");
      expect(first[5]!.note).toBe("Keep APRA note");
      expect(first[7]!.parent).toBe(7);
      expect(first[0]).toMatchObject({ tag: null, parent: null, note: "Keep my editorial note" });
      expect(first[1]).toMatchObject({ parent: 1, tag: rows[1]![2] });
      expect(first[2]!.parent).toBe(99);
      expect(first[4]!.parent).toBe(1);
      expect(first[3]).toMatchObject({ parent: null, tag: rows[3]![2] });
      await repairCoverageAudit(now);
      expect(await read()).toEqual(first);
      await db
        .update(dailyFeedItems)
        .set({ partnerTag: "An editor corrected this." })
        .where(eq(dailyFeedItems.id, 1));
      await repairCoverageAudit(now);
      expect((await read())[0]!.tag).toBe("An editor corrected this.");

      // The geography repair has already moved the US liveblog to Business.
      // Its exact audited fields still need correction, without touching any
      // other international story or a later editor override.
      const crisisUrl =
        "https://www.housingaustralia.gov.au/media/housing-australia-welcomes-australian-governments-additional-300-million-commitment-deliver";
      const brokerUrl =
        "https://www.brokernews.com.au/news/breaking-news/housing-australia-unlocks-fresh-funding-for-crisis-and-transitional-housing-289963.aspx";
      const liveUrl =
        "https://www.abc.net.au/news/2026-09-14/asx-markets-business-live-news-september-14/107148618";
      await connection.execute(
        "INSERT INTO daily_feed_items (id,title,summary,channel,feedDate,sourceUrl,whyItMatters,rubensNote) VALUES (20,'Housing Australia grant funding','Crisis and transitional housing','PROPERTY','2026-09-14',?,?,'Keep housing note')",
        [
          crisisUrl,
          "With $614.6 million approved across 115 projects as at 31 July 2026, the program's scale is real, but 968 dwellings spread nationally over 20 years leaves the structural shortfall in crisis accommodation largely intact.",
        ]
      );
      await connection.execute(
        "INSERT INTO daily_feed_items (id,title,summary,channel,feedDate,sourceUrl,rubensNote) VALUES (21,'Fresh funding','Grant conversion','PROPERTY','2026-09-14',?,'Keep broker note')",
        [brokerUrl]
      );
      await connection.execute(
        "INSERT INTO daily_feed_items (id,title,summary,channel,feedDate,sourceUrl,whyItMatters,rubensNote) VALUES (22,'Markets live updates: Wall Street rises despite hot inflation likely to trigger a Fed rate hike this week - ABC News & Headlines - Australian Broadcasting Corporation','US summary','BUSINESS','2026-09-14',?,'Edited explanation','Keep liveblog note')",
        [liveUrl]
      );
      const september14 = new Date("2026-09-14T11:00:00Z");
      await repairCoverageAudit(september14);
      const updated = await read();
      expect(updated.find((r) => r.id === 20)).toMatchObject({
        whyItMatters: expect.stringContaining("service horizon"),
        note: "Keep housing note",
      });
      expect(updated.find((r) => r.id === 21)).toMatchObject({
        parent: 20,
        note: "Keep broker note",
      });
      expect(updated.find((r) => r.id === 22)).toMatchObject({
        whyItMatters: "Edited explanation",
        note: "Keep liveblog note",
      });
      const [live] = await connection.query(
        "SELECT title,channel,feedDate FROM daily_feed_items WHERE id=22"
      );
      expect(live).toEqual([
        {
          title: "Wall Street rises as US rate expectations firm",
          channel: "BUSINESS",
          feedDate: "2026-09-14",
        },
      ]);
      await repairCoverageAudit(september14);
      expect(await read()).toEqual(updated);
    } finally {
      fixture.db = null;
      await connection.end();
    }
  }
);
