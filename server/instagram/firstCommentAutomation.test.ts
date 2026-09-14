import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  pending: vi.fn(),
  read: vi.fn(),
  claim: vi.fn(),
  mark: vi.fn(),
  pause: vi.fn(),
  savePause: vi.fn(),
  create: vi.fn(),
  exists: vi.fn(),
  receipt: vi.fn(),
  cooldown: vi.fn(),
}));
vi.mock("../core/env", () => ({
  env: {
    enableScheduler: true,
    scheduledApiKey: "test",
    instagramAccessToken: "private-token",
    instagramBusinessAccountId: "123",
  },
}));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
vi.mock("../db/jobRuns", () => ({ readJobRun: m.read, claimJobRun: m.claim, markJobRun: m.mark }));
vi.mock("../db/instagramFirstComments", () => ({
  COMMENT_DATE: "1970-01-01",
  firstCommentKey: (id: string) => `ig-comment-publish-${id}`,
  pendingFirstComments: m.pending,
  firstCommentPause: m.pause,
  pauseFirstComments: m.savePause,
  readFirstCommentReceipt: m.receipt,
}));
vi.mock("../db/health", () => ({ recordServerError: async () => {} }));
vi.mock("./post", () => ({ instagramCooldownActive: m.cooldown }));
vi.mock("./api", () => ({
  createMediaComment: m.create,
  fetchCommentExists: m.exists,
  isRateLimitError: (e: Error) => /rate limit/.test(e.message),
}));
import { runFirstCommentAutomation, excludeAutomatedFirstComment } from "./firstCommentAutomation";
import type { MediaMetricsResult } from "./api";

const now = new Date("2026-09-14T21:40:00Z");
let rows: Map<string, any>;
beforeEach(() => {
  vi.resetAllMocks();
  rows = new Map();
  m.pending.mockResolvedValue([
    { mediaId: "100", accountId: "123", message: "What changed locally?" },
    { mediaId: "200", accountId: "123", message: "Which figure needs explaining?" },
  ]);
  m.read.mockImplementation(async (key) => rows.get(key) ?? null);
  m.claim.mockImplementation(async (key) => {
    if (rows.has(key)) return 0;
    rows.set(key, { status: "running", attempts: 1 });
    return 1;
  });
  m.mark.mockImplementation(async (key, _date, status, detail) =>
    rows.set(key, { status, detail })
  );
  m.create.mockResolvedValue("900");
  m.exists.mockResolvedValue(true);
  m.receipt.mockResolvedValue({ state: "not_attempted" });
});
it("sends the saved question once, reads back its receipt, and limits the account's dispatch", async () => {
  expect(await runFirstCommentAutomation(now)).toMatchObject({
    state: "published",
    commentId: "900",
  });
  expect(m.create).toHaveBeenCalledWith({
    mediaId: "100",
    accessToken: "private-token",
    message: "What changed locally?",
  });
  expect((await runFirstCommentAutomation(now)).state).toBe("busy");
  expect(m.create).toHaveBeenCalledOnce();
  expect(m.claim).toHaveBeenCalledWith("ig-comment-publish-100", "1970-01-01", 1);
});
it("serialises concurrent replicas even when more than one post is due", async () => {
  await Promise.all([runFirstCommentAutomation(now), runFirstCommentAutomation(now)]);
  expect(m.create).toHaveBeenCalledOnce();
});
it("never retries an uncertain comment after a restart or a new day", async () => {
  m.pending.mockResolvedValue([{ mediaId: "100", accountId: "123", message: "What changed?" }]);
  m.create.mockRejectedValue(new Error("network timeout"));
  expect((await runFirstCommentAutomation(now)).state).toBe("locked");
  expect((await runFirstCommentAutomation(new Date(now.getTime() + 86400000))).state).toBe(
    "nothing-due"
  );
  expect(m.create).toHaveBeenCalledOnce();
});
it("does not report success or resend when receipt persistence fails", async () => {
  m.mark.mockResolvedValue(undefined);
  expect((await runFirstCommentAutomation(now)).state).toBe("locked");
  m.pending.mockResolvedValue([{ mediaId: "100" }]);
  expect((await runFirstCommentAutomation(new Date(now.getTime() + 300000))).state).toBe(
    "nothing-due"
  );
  expect(m.create).toHaveBeenCalledOnce();
});
it.each([
  ["rate limit reached", "rate_limited"],
  ['Instagram API 400: {"code":200}', "access_denied"],
])("pauses the account on %s without leaking the raw provider error", async (message, reason) => {
  m.create.mockRejectedValue(new Error(message));
  expect((await runFirstCommentAutomation(now)).state).toBe("paused");
  expect(m.savePause).toHaveBeenCalledWith("123", reason, now);
  expect(rows.get("ig-comment-publish-100").detail).toBe(reason);
});
it("respects the account pause, cooldown and empty queue without making a POST", async () => {
  m.pause.mockResolvedValue({ startedAt: now, detail: "access_denied" });
  expect((await runFirstCommentAutomation(now)).state).toBe("paused");
  m.cooldown.mockReturnValue(true);
  expect((await runFirstCommentAutomation(now)).state).toBe("cooldown");
  m.cooldown.mockReturnValue(false);
  m.pause.mockResolvedValue(null);
  m.pending.mockResolvedValue([]);
  expect((await runFirstCommentAutomation(now)).state).toBe("nothing-due");
  expect(m.create).not.toHaveBeenCalled();
});
it("fails closed if the durable queue cannot be read or claimed", async () => {
  m.pending.mockRejectedValueOnce(new Error("DB unavailable"));
  await expect(runFirstCommentAutomation(now)).rejects.toThrow("DB unavailable");
  m.claim.mockResolvedValue(0);
  expect((await runFirstCommentAutomation(now)).state).toBe("busy");
  expect(m.create).not.toHaveBeenCalled();
});

const metrics: MediaMetricsResult = {
  status: "complete",
  reason: null,
  metrics: { likes: 5, comments: 3, reach: 100, saved: 4, shares: 2, totalInteractions: 14 },
};
it("subtracts the verified automatic comment and preserves saves, shares, likes and reach", async () => {
  m.receipt.mockResolvedValue({ state: "published", commentId: "900" });
  const adjusted = await excludeAutomatedFirstComment("100", "token", metrics);
  expect(adjusted.metrics).toEqual({ ...metrics.metrics, comments: 2, totalInteractions: 13 });
  expect(metrics.metrics.comments).toBe(3);
  expect(m.exists).toHaveBeenCalledWith({ commentId: "900", accessToken: "token" });
});
it("preserves historic metrics when no automatic comment was attempted", async () => {
  expect(await excludeAutomatedFirstComment("100", "token", metrics)).toBe(metrics);
  expect(m.exists).not.toHaveBeenCalled();
});
it.each(["locked", "unreadable", "database"])(
  "excludes comment-based metrics for %s outcomes",
  async (mode) => {
    if (mode === "database") m.receipt.mockRejectedValue(new Error("DB unavailable"));
    else if (mode === "locked") m.receipt.mockResolvedValue({ state: "locked" });
    else {
      m.receipt.mockResolvedValue({ state: "published", commentId: "900" });
      m.exists.mockRejectedValue(new Error("deleted or denied"));
    }
    const adjusted = await excludeAutomatedFirstComment("100", "token", metrics);
    expect(adjusted).toMatchObject({
      status: "partial",
      reason: "incomplete_metrics",
      metrics: { comments: null, totalInteractions: null, reach: 100, shares: 2, saved: 4 },
    });
  }
);
it("does not manufacture a zero when provider counts contradict a confirmed comment", async () => {
  m.receipt.mockResolvedValue({ state: "published", commentId: "900" });
  expect(
    (
      await excludeAutomatedFirstComment("100", "token", {
        ...metrics,
        metrics: { ...metrics.metrics, comments: 0 },
      })
    ).metrics.comments
  ).toBeNull();
});
