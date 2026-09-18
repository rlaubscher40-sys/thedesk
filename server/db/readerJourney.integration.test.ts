import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createPool, type Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
const databaseName = "journey_test_" + randomUUID().replaceAll("-", "");
let setup: Pool | undefined, pool: Pool | undefined;
let read: typeof import("./analytics").readerJourney;
const now = new Date("2026-09-16T12:00:00Z");
const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
beforeAll(async () => {
  if (!testUrl) return;
  const url = new URL(testUrl);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/security_audit_test")
    throw new Error("Journey tests require the isolated local CI database");
  setup = createPool(testUrl);
  await setup.query(`CREATE DATABASE \`${databaseName}\``);
  url.pathname = "/" + databaseName;
  pool = createPool(url.toString());
  await pool.query(
    "CREATE TABLE page_views (id INT AUTO_INCREMENT PRIMARY KEY, viewedAt TIMESTAMP NOT NULL, path VARCHAR(256) NOT NULL, sessionId VARCHAR(64) NOT NULL)"
  );
  await pool.query(
    "CREATE TABLE subscribers (id INT AUTO_INCREMENT PRIMARY KEY, confirmedAt TIMESTAMP NULL)"
  );
  vi.doMock("./client", () => ({ getDb: () => drizzle(pool!) }));
  vi.doMock("../demo/store", () => ({ isDemoMode: () => false }));
  read = (await import("./analytics")).readerJourney;
});
afterAll(async () => {
  await pool?.end();
  if (setup) {
    await setup.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    await setup.end();
  }
});
it.skipIf(!testUrl)(
  "counts matched sessions once and excludes orphans and out-of-window evidence",
  async () => {
    expect(await read(24 * 7, now)).toEqual({
      available: true,
      sessions: 0,
      stories: 0,
      sources: 0,
      questions: 0,
      answers: 0,
      requests: 0,
      research: 0,
      confirmations: 0,
    });
    const rows: Array<[Date, string, string]> = [
      [ago(2), "/", "reader-a"],
      [ago(1), "/story/1", "reader-a"],
      [ago(1), "@event/story_open/story", "reader-a"],
      [ago(1), "@event/story_source/story", "reader-a"],
      [ago(1), "@event/ask_query/ask", "reader-a"],
      [ago(1), "@event/ask_answer/ask", "reader-a"],
      [ago(1), "@event/newsletter_request/subscribe", "reader-a"],
      [ago(1), "/", "reader-b"],
      [ago(1), "@event/market_file_source/markets", "reader-b"],
      [ago(1), "@event/ask_query/ask", "reader-b"],
      [ago(1), "@event/ask_error/ask", "reader-b"],
      [ago(1), "@event/market_compare/markets", "reader-b"],
      [ago(1), "@event/comparison_refresh/markets", "reader-b"],
      [ago(1), "@event/market_file_export/markets", "event-only"],
      [ago(1), "@event/newsletter_request/subscribe", "event-only"],
      [ago(169), "/", "old-page"],
      [ago(1), "@event/story_open/story", "old-page"],
      [ago(-1), "/", "future-page"],
      [ago(1), "@event/story_open/story", "future-page"],
      [ago(168), "/", "boundary"],
      [now, "@event/story_open/story", "boundary"],
    ];
    rows.push(
      ...Array.from(
        { length: 500 },
        () => [ago(1), "@event/story_source/story", "reader-a"] as [Date, string, string]
      )
    );
    await pool!.query("INSERT INTO subscribers (confirmedAt) VALUES ?", [
      [[ago(1)], [now], [ago(169)], [ago(-1)], [null]],
    ]);
    await pool!.query("INSERT INTO page_views (viewedAt, path, sessionId) VALUES ?", [rows]);
    expect(await read(24 * 7, now)).toEqual({
      available: true,
      sessions: 3,
      stories: 2,
      sources: 2,
      questions: 2,
      answers: 1,
      requests: 1,
      research: 1,
      confirmations: 2,
    });
    // Excluding an event's page view must not inflate the numerator.
    expect(await read(1, now)).toEqual({
      available: true,
      sessions: 2,
      stories: 1,
      sources: 2,
      questions: 2,
      answers: 1,
      requests: 1,
      research: 1,
      confirmations: 2,
    });
    await pool!.query("DROP TABLE page_views");
    expect(await read(24 * 7, now)).toEqual({ available: false });
  }
);
