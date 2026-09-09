import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  expire: vi.fn(),
  batch: vi.fn(),
  ready: vi.fn(),
  freeze: vi.fn(),
  candidates: vi.fn(),
  claim: vi.fn(),
  eligible: vi.fn(),
  finish: vi.fn(),
  feed: vi.fn(),
  send: vi.fn(),
}));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
vi.mock("../db/feed", () => ({ listFeedItems: m.feed }));
vi.mock("../db/dailyBrief", () => ({
  expireDailyBriefs: m.expire,
  readBriefBatch: m.batch,
  readReadyBriefStories: m.ready,
  freezeBriefBatch: m.freeze,
  dailyBriefCandidates: m.candidates,
  claimDailyBrief: m.claim,
  briefRecipientEligible: m.eligible,
  finishDailyBrief: m.finish,
  dailyBriefIdempotencyKey: (date: string, id: number) => `daily-brief/v1/${date}/${id}`,
}));
vi.mock("../core/mailer", () => ({
  buildDailyBriefEmail: (x: unknown) => x,
  editionUnsubscribeUrl: () => "signed-unsubscribe",
  send: m.send,
}));
import { deliverDailyBrief } from "./delivery";
const now = () => new Date("2026-09-09T21:00:00Z");
const item = {
  id: 1,
  title: "Story",
  category: "PROPERTY",
  summary: "Evidence",
  channel: "PROPERTY",
};
const payload = { to: "reader@example.com", subject: "Original", html: "Original" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("RESEND_API_KEY", "test-only");
  m.batch.mockResolvedValue(null);
  m.feed.mockResolvedValue([item]);
  m.ready.mockResolvedValue([item]);
  m.freeze.mockResolvedValue([item]);
  m.candidates.mockResolvedValue([{ id: 1, email: payload.to }]);
  m.claim.mockResolvedValue({ payload });
  m.eligible.mockResolvedValue(true);
  m.send.mockResolvedValue({ delivered: true, id: "receipt" });
});
afterEach(() => vi.unstubAllEnvs());
it("does not contact the provider outside the Sydney morning window or without a key", async () => {
  for (const stamp of ["2026-09-09T20:59:00Z", "2026-09-10T02:00:00Z", "2026-09-11T21:00:00Z"])
    await deliverDailyBrief(() => new Date(stamp));
  vi.stubEnv("RESEND_API_KEY", "");
  await deliverDailyBrief(now);
  expect(m.send).not.toHaveBeenCalled();
  expect(m.claim).not.toHaveBeenCalled();
});
it("waits for selected stories rather than sending during AI retries", async () => {
  m.ready.mockResolvedValue(null);
  await deliverDailyBrief(now);
  expect(m.send).not.toHaveBeenCalled();
  expect(m.freeze).not.toHaveBeenCalled();
});
it("uses the persisted email and stable key after restart, then records provider acceptance", async () => {
  m.batch.mockResolvedValue([item]);
  await Promise.all([deliverDailyBrief(now), deliverDailyBrief(now)]);
  expect(m.feed).not.toHaveBeenCalled();
  expect(m.send).toHaveBeenCalledTimes(1);
  expect(m.send).toHaveBeenCalledWith(payload, { idempotencyKey: "daily-brief/v1/2026-09-10/1" });
  expect(m.finish).toHaveBeenCalledWith({ payload }, "accepted", "receipt");
});
it("checks unsubscribe status immediately before sending", async () => {
  m.eligible.mockResolvedValue(false);
  await deliverDailyBrief(now);
  expect(m.send).not.toHaveBeenCalled();
  expect(m.finish).toHaveBeenCalledWith({ payload }, "skipped");
});
it("does not mark an ambiguous provider timeout as accepted", async () => {
  m.send.mockResolvedValue({ delivered: false, reason: "api-error" });
  await deliverDailyBrief(now);
  expect(m.finish).toHaveBeenCalledWith({ payload }, "retry", undefined);
});
it("fails closed on an unavailable readiness query", async () => {
  m.ready.mockRejectedValue(new Error("DB unavailable"));
  await expect(deliverDailyBrief(now)).rejects.toThrow();
  expect(m.send).not.toHaveBeenCalled();
});
it("rechecks the delivery window after claiming a recipient", async () => {
  let calls = 0;
  await deliverDailyBrief(() => (++calls <= 3 ? now() : new Date("2026-09-10T02:00:00Z")));
  expect(m.claim).toHaveBeenCalled();
  expect(m.send).not.toHaveBeenCalled();
});
