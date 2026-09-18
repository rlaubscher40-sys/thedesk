import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Express, Request, Response } from "express";
const m = vi.hoisted(() => ({
  synth: vi.fn(),
  review: vi.fn(),
  insert: vi.fn(),
  feed: vi.fn(),
  metrics: vi.fn(),
  editions: vi.fn(),
}));
vi.mock("../core/env", () => ({
  env: { scheduledApiKey: "fixture" },
  signingSecret: () => "fixture",
}));
vi.mock("../db", () => ({
  listFeedItemsBetween: m.feed,
  listDailyMetrics: m.metrics,
  listEditions: m.editions,
  createEditionWithNextNumber: m.insert,
}));
vi.mock("../prompts", async (original) => ({
  ...(await original<object>()),
  synthesizeWeeklyEdition: m.synth,
  runEditorQc: m.review,
}));
import { registerScheduledRoutes } from "../scheduledRoutes";
const routes = new Map<string, (req: Request, res: Response) => Promise<void>>();
registerScheduledRoutes({
  post: (path: string, ...handlers: unknown[]) => routes.set(path, handlers.at(-1) as never),
  get: () => {},
} as unknown as Express);
const draft = {
  topics: [{ title: "Unreviewed", summary: "Draft", category: "PROPERTY" }],
  signals: [],
  keyMetrics: {},
  readingTime: "5 min",
  fullText: "Unreviewed text",
  marketStress: null,
  datesToWatch: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(globalThis, "setImmediate").mockImplementation(() => ({}) as NodeJS.Immediate);
  m.feed.mockResolvedValue([
    {
      id: 7,
      channel: "PROPERTY",
      title: "Source housing report",
      summary: "Dated source detail",
      source: "Publisher",
      sourceUrl: "https://publisher.com.au/story",
      feedDate: "2026-09-08",
    },
  ]);
  m.metrics.mockResolvedValue([]);
  m.editions.mockResolvedValue([]);
  m.synth.mockResolvedValue(draft);
  m.insert.mockResolvedValue(18);
});
afterEach(() => vi.restoreAllMocks());
async function run() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await routes.get("/api/ingest/synthesize-edition")!(
    { headers: { "x-scheduled-key": "fixture" }, body: { anyDateInWeek: "2026-09-08" } } as Request,
    res as unknown as Response
  );
  return res;
}
it("publishes only the reviewed version after review receives source reporting", async () => {
  m.review.mockResolvedValue({
    approved: false,
    notes: ["Qualified forecast"],
    revised: { ...draft, fullText: "Reviewed text" },
  });
  const res = await run();
  expect(m.review.mock.calls[0]![1]).toContain("Dated source detail");
  expect(m.insert).toHaveBeenCalledOnce();
  expect(m.insert.mock.calls[0]![0](18).fullText).toBe("Reviewed text");
  expect(m.review.mock.invocationCallOrder[0]).toBeLessThan(m.insert.mock.invocationCallOrder[0]!);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
});
it("holds publication when editorial review is unavailable", async () => {
  m.review.mockRejectedValue(new Error("Review unavailable"));
  const res = await run();
  expect(res.status).toHaveBeenCalledWith(503);
  expect(m.insert).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({
    error: "Editorial review failed; edition not published",
  });
});
