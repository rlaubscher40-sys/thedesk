import { beforeEach, expect, it, vi } from "vitest";
import type { TrpcContext } from "../core/context";
import type { Express, Request, Response, NextFunction } from "express";
const m = vi.hoisted(() => ({ one: vi.fn(), many: vi.fn(), render: vi.fn(), add: vi.fn() }));
vi.mock("../db", () => ({ getFeedItemById: m.one, getFeedItemsByIds: m.many, addToQueue: m.add }));
vi.mock("../core/publicRender", () => ({
  renderDailyHookCoverCard: m.render,
  renderDeskTakeCard: m.render,
  renderSignalCard: m.render,
  renderTrendCard: m.render,
  renderIntelligenceCard: m.render,
}));
vi.mock("node:fs", () => ({
  default: {
    existsSync: () => true,
    promises: {
      readFile: async () =>
        '<html><head><title>The Desk</title></head><body><div id="root"></div></body></html>',
    },
  },
}));
import { feedRouter } from "./feed";
import { shareRouter } from "./share";
import { readingQueueRouter } from "./readingQueue";
import { registerSeoRoutes } from "../core/seo";
import { registerDistributionSeoRoutes } from "../core/distributionSeo";
const held = {
  id: 1,
  title: "PRIVATE-HELD-TITLE",
  summary: "PRIVATE-HELD-SUMMARY",
  sayThis: "PRIVATE-HELD-TAKE",
  channel: "HOLD",
};
const visible = { id: 2, title: "Public story", channel: "PROPERTY" };
const ctx = { req: { headers: {} }, res: {}, user: null } as TrpcContext;
beforeEach(() => {
  vi.clearAllMocks();
  m.one.mockResolvedValue(held);
  m.many.mockResolvedValue([held, visible]);
});
it("does not return held stories through direct or saved-ID public reads", async () => {
  const caller = feedRouter.createCaller(ctx);
  expect(await caller.getById({ id: 1 })).toBeUndefined();
  expect(await caller.getByIds({ ids: [1, 2] })).toEqual([visible]);
  m.one.mockResolvedValue(visible);
  expect(await caller.getById({ id: 2 })).toEqual(visible);
});
it("does not render held story or take cards even for a signed-in reader", async () => {
  for (const user of [null, { id: 2, role: "user" }, { id: 1, role: "admin" }]) {
    const caller = shareRouter.createCaller({ ...ctx, user } as TrpcContext);
    await expect(caller.storyCard({ id: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.takeCard({ id: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  }
  expect(m.render).not.toHaveBeenCalled();
});
it("does not copy held source titles into a reading queue", async () => {
  await expect(
    readingQueueRouter
      .createCaller({ ...ctx, user: { id: 2, role: "user" } } as TrpcContext)
      .add({ feedItemId: 1 })
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(m.add).not.toHaveBeenCalled();
});
it("does not expose held prose in HTML, structured data or image previews", async () => {
  for (const register of [registerSeoRoutes, registerDistributionSeoRoutes]) {
    const handlers = new Map<string, Function>();
    register({
      get: (path: string, ...rest: Function[]) => handlers.set(path, rest.at(-1)!),
    } as unknown as Express);
    for (const path of ["/story/:id", "/og/story/:id.jpg"]) {
      const handler = handlers.get(path);
      if (!handler) continue;
      const res = {
        status: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        send: vi.fn(),
        redirect: vi.fn(),
      };
      await handler(
        { params: { id: "1" }, headers: { accept: "*/*" }, query: {} } as unknown as Request,
        res as unknown as Response,
        vi.fn() as NextFunction
      );
      expect(JSON.stringify(res.send.mock.calls)).not.toContain("PRIVATE-HELD");
      if (register === registerSeoRoutes) expect(res.status).toHaveBeenCalledWith(404);
    }
  }
  expect(m.render).not.toHaveBeenCalled();
});
