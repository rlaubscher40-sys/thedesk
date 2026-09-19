import { expect, it, vi } from "vitest";
import { createConnection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
const state = vi.hoisted(() => ({ db: null as ReturnType<typeof drizzle> | null, audit: vi.fn() }));
vi.mock("./client", () => ({ getDb: () => state.db }));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
vi.mock("../instagram/reelRenderAudit", () => ({ readReelRenderAudit: state.audit }));
import { readReelReview, saveReelReview } from "./reelReviews";
const input = {
  publication: { key: "instagram-reel-example", date: "2026-09-01" },
  postId: "123",
  videoSha256: "a".repeat(64),
  version: 0,
  watchedAndListened: false,
  checks: {
    hook: "pending",
    progression: "pending",
    evidence: "pending",
    pictures: "pending",
    voice: "pending",
    sync: "pending",
  },
  notes: "",
  nextTest: "",
} as const;
it("distinguishes an unavailable review store from an empty review", async () => {
  await expect(readReelReview(input)).rejects.toThrow("unavailable");
  await expect(saveReelReview(input, 7)).rejects.toThrow("unavailable");
});
const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
it.skipIf(!testUrl)(
  "binds reviews to the exact export and rejects competing revisions without touching publications",
  async () => {
    const url = new URL(testUrl!);
    if (
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.pathname !== "/security_audit_test"
    )
      throw new Error("Requires isolated local test database");
    const connection = await createConnection(testUrl!);
    try {
      await connection.query(
        "CREATE TEMPORARY TABLE job_runs (id INT AUTO_INCREMENT PRIMARY KEY, jobKey VARCHAR(64), runDate VARCHAR(10), status VARCHAR(16), attempts INT, detail TEXT, startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, finishedAt TIMESTAMP NULL, UNIQUE KEY (jobKey, runDate))"
      );
      state.db = drizzle(connection);
      state.audit.mockResolvedValue({
        state: "recorded",
        postId: input.postId,
        render: { videoSha256: input.videoSha256 },
      });
      expect(await readReelReview(input)).toBeNull();
      const results = await Promise.allSettled([
        saveReelReview(input, 7),
        saveReelReview(input, 8),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.find((result) => result.status === "rejected")).toMatchObject({
        reason: { code: "CONFLICT" },
      });
      expect(await readReelReview(input)).toMatchObject({ review: { version: 1 }, reviewerId: 7 });
      const saved = await saveReelReview(
        { ...input, version: 1, notes: "00:10 — clearer picture next time" },
        8
      );
      expect(saved).toMatchObject({ review: { version: 2 }, reviewerId: 8 });
      await expect(saveReelReview({ ...input, version: 1 }, 7)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      await expect(
        saveReelReview({ ...input, videoSha256: "b".repeat(64) }, 7)
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(saveReelReview({ ...input, postId: "999" }, 7)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      expect(await readReelReview({ ...input, videoSha256: "b".repeat(64) })).toBeNull();
      const [rows] = await connection.query("SELECT jobKey FROM job_runs");
      expect(rows).toEqual([{ jobKey: expect.stringMatching(/^reel-human-review-/) }]);
    } finally {
      state.db = null;
      await connection.end();
    }
  }
);
