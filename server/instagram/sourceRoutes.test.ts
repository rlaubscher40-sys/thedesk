import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express, Request, Response } from "express";
const m = vi.hoisted(() => ({
  feed: vi.fn(),
  editions: vi.fn(),
  publish: vi.fn(),
  metrics: vi.fn(),
  weekly: vi.fn(),
  record: vi.fn(),
}));
vi.mock("../core/env", () => ({
  env: {
    scheduledApiKey: "fixture",
    instagramAccessToken: "fixture",
    instagramBusinessAccountId: "fixture",
  },
  signingSecret: () => "fixture",
}));
vi.mock("../db", () => ({
  recordServerError: async () => {},
  listFeedItems: m.feed,
  listEditions: m.editions,
  recordInstagramPost: m.record,
  latestGridCoverVariant: async () => "light",
  listInstagramPosts: async () => [],
  listDailyMetrics: m.metrics,
}));
vi.mock("./post", () => ({
  postDailyCarousel: m.publish,
  postWeeklyEdition: m.weekly,
  findAlreadyPublished: async () => null,
  pickDailyTopStories: (items: unknown[]) => items,
}));
import { registerScheduledRoutes } from "../scheduledRoutes";
const routes = new Map<string, (req: Request, res: Response) => Promise<void>>();
registerScheduledRoutes({
  post: (path: string, ...handlers: unknown[]) => routes.set(path, handlers.at(-1) as never),
  get: () => {},
} as unknown as Express);
async function request(path: string, body = {}) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await routes.get(path)!(
    { headers: { "x-scheduled-key": "fixture" }, body } as Request,
    res as unknown as Response
  );
  return res;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-08T21:30:00Z"));
  m.feed.mockResolvedValue([]);
  m.metrics.mockResolvedValue([]);
  m.editions.mockResolvedValue([]);
  m.publish.mockResolvedValue({ postId: "fixture-media", headline: "Housing update" });
  m.weekly.mockResolvedValue({ postId: "fixture-weekly", headline: "Housing update" });
});
afterEach(() => vi.useRealTimers());
describe("actual scheduled social entrypoints", () => {
  it.each(["scheduled", "ingest"])(
    "%s daily does not fall back to yesterday or publish an empty run",
    async (prefix) => {
      m.feed.mockResolvedValue([{ id: 1, feedDate: "2026-09-08", channel: "PROPERTY" }]);
      const res = await request(`/api/${prefix}/instagram-daily`);
      expect(m.feed).toHaveBeenCalledWith("2026-09-09");
      expect(res.status).toHaveBeenCalledWith(422);
      expect(m.publish).not.toHaveBeenCalled();
    }
  );
  it("publishes and records the current Sydney date", async () => {
    m.feed.mockResolvedValue([
      { id: 1, feedDate: "2026-09-09", channel: "PROPERTY", title: "Housing update" },
    ]);
    await request("/api/ingest/instagram-daily");
    expect(m.publish).toHaveBeenCalledOnce();
    expect(m.record).toHaveBeenCalledWith(
      expect.objectContaining({ feedDate: "2026-09-09", mediaId: "fixture-media" })
    );
  });
  it("keeps unrelated FX and equities out of the daily cover strip", async () => {
    m.feed.mockResolvedValue([
      { id: 1, feedDate: "2026-09-09", channel: "PROPERTY", title: "Housing update" },
    ]);
    m.metrics.mockResolvedValue([
      { metricKey: "aud_usd", label: "AUD/USD", value: "0.65" },
      { metricKey: "asx200", label: "ASX", value: "8000" },
      { metricKey: "cash_rate", label: "Cash rate", value: "3.85", unit: "%" },
    ]);
    await request("/api/ingest/instagram-daily");
    expect(m.publish).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(String),
      expect.objectContaining({ metrics: [{ label: "Cash rate", value: "3.85%" }] })
    );
  });
  it("rejects malformed requests rather than silently publishing today", async () => {
    const res = await request("/api/ingest/instagram-daily", { feedDate: "bad" });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(m.feed).not.toHaveBeenCalled();
  });
  it("refuses an old weekly edition and a current edition with no property topics", async () => {
    for (const edition of [
      {
        weekOf: "2026-08-31",
        topics: [
          { title: "Housing approvals rise", summary: "Dwelling approvals", category: "PROPERTY" },
        ],
      },
      {
        weekOf: "2026-09-07",
        topics: [{ title: "ASX rises", summary: "Chipmaker earnings", category: "PROPERTY" }],
      },
    ]) {
      m.editions.mockResolvedValue([edition]);
      const res = await request("/api/ingest/instagram-weekly");
      expect(res.status).toHaveBeenCalledWith(422);
    }
    expect(m.weekly).not.toHaveBeenCalled();
  });
  it("accepts the current property edition", async () => {
    const edition = {
      editionNumber: 10,
      weekOf: "2026-09-07",
      topics: [
        { title: "Housing approvals rise", summary: "Dwelling approvals", category: "PROPERTY" },
      ],
    };
    m.editions.mockResolvedValue([edition]);
    await request("/api/ingest/instagram-weekly");
    expect(m.weekly).toHaveBeenCalledWith(edition, expect.any(String), expect.any(String));
  });
});
