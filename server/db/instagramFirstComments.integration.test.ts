import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createPool, type Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { CATCHUP_STATEMENTS, isHarmless } from "./catchup";

const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
let pool: Pool;
let record: typeof import("./instagramPosts").recordInstagramPost;
let pending: typeof import("./instagramFirstComments").pendingFirstComments;
const mediaId = "990000000000000010";
const recoveredId = "990000000000000011";
beforeAll(async () => {
  if (!testUrl) return;
  const url = new URL(testUrl);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/security_audit_test")
    throw new Error("Use the isolated local test database");
  pool = createPool(testUrl);
  for (const row of CATCHUP_STATEMENTS.filter(
    (row) =>
      row.name === "0015 · instagram_posts table" ||
      row.name === "0021 · instagram_posts.coverVariant" ||
      row.name === "0020 · job_runs table" ||
      row.name.startsWith("insights ·")
  )) {
    try {
      await pool.query(row.sql);
    } catch (err) {
      if (!isHarmless(err)) throw err;
    }
  }
  await pool.query("DELETE FROM instagram_posts WHERE mediaId IN (?, ?)", [mediaId, recoveredId]);
  await pool.query("DELETE FROM job_runs WHERE jobKey IN (?, ?)", [
    `ig-comment-source-${mediaId}`,
    `ig-comment-source-${recoveredId}`,
  ]);
  vi.doMock("./client", () => ({ getDb: () => drizzle(pool) }));
  vi.doMock("../demo/store", () => ({ isDemoMode: () => false }));
  vi.doMock("../core/env", () => ({
    env: { instagramAccessToken: "test", instagramBusinessAccountId: "123" },
  }));
  record = (await import("./instagramPosts")).recordInstagramPost;
  pending = (await import("./instagramFirstComments")).pendingFirstComments;
});
afterAll(async () => {
  await pool?.end();
});
it.skipIf(!testUrl)(
  "enrols once under concurrent recording, retains the question, and excludes recovered posts",
  async () => {
    const input = { mediaId, postType: "reel" as const, headline: "New home loan rates" };
    await Promise.all([
      record(input, { enrolFirstComment: true }),
      record(input, { enrolFirstComment: true }),
    ]);
    await record({ ...input, headline: "Changed headline" }, { enrolFirstComment: true });
    await record({ ...input, mediaId: recoveredId });
    const [rows] = await pool.query("SELECT detail FROM job_runs WHERE jobKey IN (?, ?)", [
      `ig-comment-source-${mediaId}`,
      `ig-comment-source-${recoveredId}`,
    ]);
    expect(rows).toHaveLength(1);
    const source = JSON.parse((rows as any[])[0].detail);
    expect(source.message).toContain("borrowing capacity");
    expect(await pending(new Date(source.enrolledAt + 600000), "123")).toContainEqual(source);
    expect(
      (await pending(new Date(source.enrolledAt + 60000), "123")).some(
        (row) => row.mediaId === mediaId
      )
    ).toBe(false);
    expect(
      (await pending(new Date(source.enrolledAt + 3 * 3600000), "123")).some(
        (row) => row.mediaId === mediaId
      )
    ).toBe(false);
  }
);
