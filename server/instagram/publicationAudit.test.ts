import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ receipts: vi.fn(), items: vi.fn(), jobs: vi.fn() }));
vi.mock("../db/socialPublication", () => ({ recentSocialReceipts: m.receipts }));
vi.mock("../db/feed", () => ({ getFeedItemsByIds: m.items }));
vi.mock("../db/feedEnrichment", () => ({ feedEnrichmentStates: m.jobs }));
import { publicationAudit } from "./publicationAudit";
beforeEach(() => {
  vi.resetAllMocks();
  m.items.mockResolvedValue([]);
  m.jobs.mockResolvedValue([]);
});
it("uses exact confirmed story IDs and does not invent missing legacy evidence", async () => {
  m.receipts.mockResolvedValue([
    { detail: JSON.stringify({ postId: "123", storyIds: [42] }), finishedAt: new Date() },
  ]);
  m.items.mockResolvedValue([
    { id: 42, channel: "AU", feedDate: "2026-09-10", createdAt: new Date(), sourceTiming: null },
  ]);
  const [result] = await publicationAudit();
  expect(m.items).toHaveBeenCalledWith([42]);
  expect(m.jobs).toHaveBeenCalledWith([42]);
  expect(result).toMatchObject({
    mediaId: "123",
    stories: [
      {
        id: 42,
        capturedAtPublication: null,
        currentRecord: { feedDate: "2026-09-10" },
        enrichment: { status: "unknown" },
      },
    ],
  });
});
it("keeps captured dates distinct from a later record and reports failed enrichment", async () => {
  const captured = {
    id: 42,
    feedDate: "2026-09-10",
    importedAt: "2026-09-09T20:43:00.000Z",
    sourceTiming: null,
  };
  m.receipts.mockResolvedValue([
    {
      detail: JSON.stringify({ postId: "123", storyIds: [42], storyEvidence: [captured] }),
      finishedAt: new Date(),
    },
  ]);
  m.items.mockResolvedValue([
    { id: 42, channel: "AU", feedDate: "2026-09-11", createdAt: new Date(), sourceTiming: null },
  ]);
  m.jobs.mockResolvedValue([{ feedItemId: 42, status: "failed", reason: "attempts_exhausted" }]);
  const [result] = await publicationAudit();
  expect(result.stories[0]).toMatchObject({
    capturedAtPublication: captured,
    currentRecord: { feedDate: "2026-09-11" },
    enrichment: { status: "failed" },
  });
});
it("rejects malformed receipts without using today's feed as a substitute", async () => {
  m.receipts.mockResolvedValue([
    { detail: "not json" },
    { detail: JSON.stringify({ postId: "123" }) },
  ]);
  expect(await publicationAudit()).toEqual([]);
  expect(m.items).toHaveBeenCalledWith([]);
});
