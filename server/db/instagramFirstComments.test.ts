import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ db: vi.fn(), rows: vi.fn(), read: vi.fn() }));
vi.mock("./client", () => ({ getDb: m.db }));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
vi.mock("./jobRuns", () => ({ readJobRun: m.read }));
import {
  firstCommentSourceRow,
  pendingFirstComments,
  readFirstCommentReceipt,
} from "./instagramFirstComments";
const now = new Date("2026-09-14T21:40:00Z");
const source = {
  mediaId: "100",
  accountId: "123",
  enrolledAt: now.getTime() - 600000,
  message: "What is changing locally?",
};
beforeEach(() => {
  vi.resetAllMocks();
  m.db.mockReturnValue({
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: m.rows }) }) }) }),
  });
});
it("accepts only an exact fresh source for the connected account", async () => {
  const valid = firstCommentSourceRow(source);
  m.rows.mockResolvedValue([
    valid,
    firstCommentSourceRow({ ...source, mediaId: "200", accountId: "999" }),
    firstCommentSourceRow({ ...source, mediaId: "300", enrolledAt: now.getTime() - 3 * 3600000 }),
    firstCommentSourceRow({ ...source, mediaId: "400", enrolledAt: now.getTime() + 1000 }),
    firstCommentSourceRow({ ...source, mediaId: "500", enrolledAt: now.getTime() - 60000 }),
    { ...valid, jobKey: "ig-comment-source-999" },
    { ...valid, detail: "broken JSON" },
  ]);
  expect(await pendingFirstComments(now, "123")).toEqual([{ ...source, version: 1 }]);
});
it("treats corrupt or unconfirmed receipts as locked instead of absent", async () => {
  m.read.mockResolvedValue(null);
  expect(await readFirstCommentReceipt("100")).toEqual({ state: "not_attempted" });
  for (const row of [
    { status: "running" },
    { status: "failed" },
    { status: "success", detail: "invalid" },
    { status: "success", detail: JSON.stringify({ version: 1, mediaId: "999", commentId: "900" }) },
  ]) {
    m.read.mockResolvedValue(row);
    expect(await readFirstCommentReceipt("100")).toEqual({ state: "locked" });
  }
  m.read.mockResolvedValue({
    status: "success",
    detail: JSON.stringify({ version: 1, mediaId: "100", commentId: "900" }),
  });
  expect(await readFirstCommentReceipt("100")).toEqual({ state: "published", commentId: "900" });
});
it("fails closed when the database is unavailable", async () => {
  m.db.mockReturnValue(null);
  await expect(pendingFirstComments(now, "123")).rejects.toThrow("unavailable");
});
