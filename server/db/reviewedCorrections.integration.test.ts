import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createPool, type Pool, type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { REVIEWED_STORY_CORRECTIONS } from "../../shared/reviewedStoryCorrections";
const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
const databaseName = "corrections_test_" + randomUUID().replaceAll("-", "");
let setup: Pool | undefined, pool: Pool | undefined;
let apply: typeof import("./reviewedCorrections").applyReviewedStoryCorrections;
beforeAll(async () => {
  if (!testUrl) return;
  const url = new URL(testUrl);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/security_audit_test")
    throw new Error("Corrections tests require the isolated local CI database");
  setup = createPool(testUrl);
  await setup.query(`CREATE DATABASE \`${databaseName}\``);
  url.pathname = "/" + databaseName;
  pool = createPool(url.toString());
  await pool.query(
    "CREATE TABLE daily_feed_items (id INT PRIMARY KEY, title TEXT, sourceUrl TEXT, summary TEXT, partnerTag TEXT, whyItMatters TEXT, sayThis TEXT, counterpoint TEXT)"
  );
  vi.doMock("./client", () => ({ getDb: () => drizzle(pool!) }));
  apply = (await import("./reviewedCorrections")).applyReviewedStoryCorrections;
});
afterAll(async () => {
  await pool?.end();
  if (setup) {
    await setup.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    await setup.end();
  }
});
it.skipIf(!testUrl)(
  "corrects only exact reviewed values, remains idempotent and preserves later edits and other sources",
  async () => {
    for (const c of REVIEWED_STORY_CORRECTIONS) {
      await pool!.query("INSERT INTO daily_feed_items SET ?", {
        id: c.id,
        sourceUrl: c.sourceUrl,
        ...Object.fromEntries(c.fields.map((f) => [f.field, f.before])),
      });
    }
    await apply();
    for (const c of REVIEWED_STORY_CORRECTIONS) {
      const [rows] = await pool!.query<RowDataPacket[]>(
        "SELECT * FROM daily_feed_items WHERE id=?",
        [c.id]
      );
      for (const f of c.fields) expect(rows[0]![f.field]).toBe(f.after);
    }
    await apply();
    const [first, second] = REVIEWED_STORY_CORRECTIONS;
    const original = first!.fields.find((f) => f.field === "summary")!.before;
    await pool!.query("UPDATE daily_feed_items SET summary=? WHERE id=?", [
      original.toUpperCase(),
      first!.id,
    ]);
    await apply();
    const [caseEdit] = await pool!.query<RowDataPacket[]>(
      "SELECT summary FROM daily_feed_items WHERE id=?",
      [first!.id]
    );
    expect(caseEdit[0]!.summary).toBe(original.toUpperCase());
    await pool!.query("UPDATE daily_feed_items SET summary=? WHERE id=?", [
      "A later editor's source-checked correction",
      first!.id,
    ]);
    await pool!.query("UPDATE daily_feed_items SET sourceUrl=?, summary=? WHERE id=?", [
      "https://different.example.test/story",
      second!.fields.find((f) => f.field === "summary")!.before,
      second!.id,
    ]);
    await apply();
    const [rows] = await pool!.query<RowDataPacket[]>(
      "SELECT * FROM daily_feed_items WHERE id IN (?,?) ORDER BY id",
      [first!.id, second!.id]
    );
    expect(rows.find((r) => r.id === first!.id)!.summary).toBe(
      "A later editor's source-checked correction"
    );
    expect(rows.find((r) => r.id === second!.id)!.summary).toBe(
      second!.fields.find((f) => f.field === "summary")!.before
    );
  }
);
