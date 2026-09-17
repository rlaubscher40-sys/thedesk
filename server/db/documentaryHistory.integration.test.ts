import { expect, it, vi } from "vitest";
import { createConnection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
const state = vi.hoisted(() => ({ db: null as ReturnType<typeof drizzle> | null }));
vi.mock("./client", () => ({ getDb: () => state.db }));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
import { readDocumentaryComparisonHistory } from "./documentaryHistory";
const now = new Date("2026-09-17T06:00:00Z");
it("fails closed without durable comparison history", async () => {
  await expect(readDocumentaryComparisonHistory(now)).rejects.toThrow("unavailable");
});
const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
it.skipIf(!testUrl)(
  "links delivery watermarks to permanent receipts and rejects orphan deliveries or posts",
  async () => {
    const url = new URL(testUrl!);
    if (
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.pathname !== "/security_audit_test"
    )
      throw new Error("Requires isolated local test database");
    const connection = await createConnection(testUrl!);
    try {
      await connection.query("SET time_zone = '+00:00'");
      await connection.query(
        "CREATE TEMPORARY TABLE job_runs (jobKey VARCHAR(128), runDate VARCHAR(10), status VARCHAR(16), detail TEXT, startedAt TIMESTAMP NULL, finishedAt TIMESTAMP NULL)"
      );
      await connection.query(
        "CREATE TEMPORARY TABLE instagram_posts (mediaId VARCHAR(64), postType VARCHAR(16), createdAt TIMESTAMP NULL)"
      );
      for (const row of [
        ["instagram-reel-ordinary", "2026-06-01", "Published media 123"],
        ["instagram-reel-ordinary", "2026-07-01", "Published media 456"],
        ["instagram-reel-unknown", "2026-07-01", "Published media 789"],
        ["instagram-reel-delivery-programme-v1", "2026-09-16", "Published media 456"],
        ["instagram-reel-delivery-speech2-2026-07-01", "2026-09-15", "Published media 123"],
        ["instagram-reel-delivery-2026-07-01", "2026-09-14", "Published media 123"],
        ["instagram-reel-skipped", "2026-09-16", "Skipped"],
      ])
        await connection.execute(
          "INSERT INTO job_runs VALUES (?, ?, 'success', ?, '2026-09-16 08:30:00', '2026-09-16 08:31:00')",
          row
        );
      await connection.execute(
        "INSERT INTO instagram_posts VALUES ('456', 'reel', '2026-09-16 08:31:00')"
      );
      state.db = drizzle(connection);
      const records = await readDocumentaryComparisonHistory(now);
      expect(records.map((r) => r.postId).sort()).toEqual(["123", "456", "789"]);
      expect(records.some((r) => r.key === "instagram-reel-unknown")).toBe(true);
      await connection.execute(
        "INSERT INTO job_runs VALUES ('instagram-reel-delivery-speech2-2026-08-01', '2026-09-16', 'success', 'Published media 888', '2026-09-16 08:30:00', '2026-09-16 08:31:00')"
      );
      await expect(readDocumentaryComparisonHistory(now)).rejects.toThrow(
        "delivery lacks a linked"
      );
      await connection.execute(
        "DELETE FROM job_runs WHERE jobKey = 'instagram-reel-delivery-speech2-2026-08-01'"
      );
      await connection.execute(
        "INSERT INTO instagram_posts VALUES ('999', 'reel', '2026-09-16 08:31:00')"
      );
      await expect(readDocumentaryComparisonHistory(now)).rejects.toThrow("lacks a linked");
    } finally {
      state.db = null;
      await connection.end();
    }
  }
);
