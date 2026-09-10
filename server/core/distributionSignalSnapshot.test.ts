import { beforeEach, expect, it, vi } from "vitest";
import type { Express, Request, Response, NextFunction } from "express";
const m = vi.hoisted(() => ({ read: vi.fn(), list: vi.fn(), histories: vi.fn(), editions: vi.fn(), number: vi.fn(), chart: vi.fn() }));
vi.mock("../db", () => ({ readSignalSnapshot: m.read, listDailyMetrics: m.list, listMetricHistories: m.histories, listEditionSummaries: m.editions }));
vi.mock("../core/publicRender", () => ({ renderSignalCard: m.number, renderTrendCard: m.chart, renderDailyHookCoverCard: vi.fn(), renderIntelligenceCard: vi.fn() }));
vi.mock("node:fs", () => ({ default: { existsSync: () => true, promises: {
  readFile: async () => '<html><head><title>The Desk</title></head><body><div id="root"></div></body></html>',
} } }));
import { registerDistributionSeoRoutes } from "./distributionSeo";

const handlers = new Map<string, (req: Request, res: Response, next: NextFunction) => Promise<void>>();
registerDistributionSeoRoutes({ get: (path: string, ...rest: Array<(...args: any[]) => any>) => handlers.set(path, rest.at(-1)!) } as unknown as Express);
const id = "a".repeat(64);
const frozen = {
  version: 1, metric: { metricKey: "cash_rate", label: "Cash rate", value: "3.5", unit: "%",
    context: "Saved context", source: "RBA", asOf: new Date("2024-01-01Z") },
  series: [{ value: 3.4, recordedAt: new Date("2023-12-01Z") }, { value: 3.5, recordedAt: new Date("2024-01-01Z") }],
  deskTake: "Saved take", move: "Saved change",
};
beforeEach(() => {
  vi.clearAllMocks(); m.read.mockResolvedValue(structuredClone(frozen));
  m.number.mockResolvedValue(Buffer.from("number")); m.chart.mockResolvedValue(Buffer.from("chart"));
});

async function request(route: string, query: Record<string, string>) {
  const res = { status: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(), send: vi.fn(), redirect: vi.fn() };
  const next = vi.fn();
  await handlers.get(route)!({ query, headers: { accept: "text/html" }, params: { metricKey: "cash_rate" } } as unknown as Request, res as unknown as Response, next);
  return { res, next };
}

it("pins both canonical and image previews to the same saved dated observation", async () => {
  const { res } = await request("/signals", { metric: "cash_rate", snapshot: id, view: "chart" });
  const html = res.send.mock.calls[0][0];
  expect(html).toContain(`snapshot=${id}&amp;view=chart`);
  expect(html).toContain(`/og/charts/cash_rate.png?snapshot=${id}`);
  expect(html).toContain("Observation 1 Jan 2024");
  expect(m.list).not.toHaveBeenCalled(); expect(m.histories).not.toHaveBeenCalled();
});

it.each(["/og/signals/:metricKey.png", "/og/charts/:metricKey.png"])("renders %s from the frozen evidence", async route => {
  await request(route, { snapshot: id });
  const card = route.includes("charts") ? m.chart : m.number;
  expect(card.mock.calls[0][0]).toMatchObject({ value: "3.5%", source: "RBA", asOf: "1 Jan 2024" });
  if (route.includes("charts")) expect(card.mock.calls[0][0].series).toEqual(frozen.series);
  else expect(card.mock.calls[0][0].deskTake).toBe("Saved take");
  expect(m.list).not.toHaveBeenCalled();
});

it("returns neutral unavailable metadata and no live rendering for a missing snapshot", async () => {
  m.read.mockResolvedValue(null);
  const { res } = await request("/signals", { metric: "cash_rate", snapshot: id });
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.send.mock.calls[0][0]).toContain("Shared observation unavailable");
  const og = await request("/og/signals/:metricKey.png", { snapshot: id });
  expect(og.res.redirect).toHaveBeenCalledWith(302, "/og-card.png");
  expect(m.list).not.toHaveBeenCalled(); expect(m.number).not.toHaveBeenCalled();
});

it("rejects mismatched metric identities without a live fallback", async () => {
  const { res } = await request("/signals", { metric: "other", snapshot: id });
  expect(res.status).toHaveBeenCalledWith(404);
  expect(m.list).not.toHaveBeenCalled();
});
