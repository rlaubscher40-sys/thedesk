import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ metrics: [] as any[], writes: [] as any[], connected: true }));
vi.mock("../db/client", () => ({ getDb: () => (state.connected ? {} : null) }));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
vi.mock("../db/dailyMetrics", () => ({
  listDailyMetrics: async () => state.metrics,
  upsertDailyMetric: vi.fn(async (row) => {
    state.writes.push(row);
    if (row.metricKey === "audusd") throw new Error("write failed");
  }),
}));
vi.mock("../../scripts/ingest/dailyMetrics", () => ({
  runDailyMetricsIngest: vi.fn(async (_base, _key, options) => {
    expect(options.extractFromNews).toBe(false);
    await options.persist([
      { metricKey: "cash_rate", label: "RBA", value: "4.35", asOf: "2026-09-07T00:00:00Z" },
      { metricKey: "audusd", label: "AUD", value: "0.65", asOf: "2026-09-07T00:00:00Z" },
    ]);
  }),
}));
beforeEach(() => {
  vi.resetModules();
  state.metrics = [];
  state.writes = [];
  state.connected = true;
  vi.clearAllMocks();
});

it("collects missing metrics directly and reports missing sources separately from failed writes", async () => {
  const { refreshOfficialMetrics, metricRefreshStatus } = await import("./recovery");
  const report = await refreshOfficialMetrics();
  expect(report.stored).toBe(1);
  expect(report.failedWrites).toEqual(["audusd"]);
  expect(report.unavailable).toContain("tas_population");
  expect(report.unavailable).not.toContain("audusd");
  expect(report.unavailable).not.toContain("auction_clearance");
  expect(state.writes[0].asOf).toEqual(new Date("2026-09-07"));
  expect(metricRefreshStatus().lastReport).toEqual(report);
  expect(metricRefreshStatus().running).toBe(false);
});
it("shares concurrent refreshes and briefly reuses the completed result", async () => {
  const { refreshOfficialMetrics } = await import("./recovery");
  const first = refreshOfficialMetrics();
  expect(refreshOfficialMetrics()).toBe(first);
  const report = await first;
  expect(await refreshOfficialMetrics()).toEqual(report);
  expect(state.writes).toHaveLength(2);
});
it("does not claim partial collection is a successful automatic recovery", async () => {
  const { recoverMissingMetrics } = await import("./recovery");
  await expect(recoverMissingMetrics()).rejects.toThrow("Metric refresh stored 1");
});
it("rejects collection before contacting sources when storage is unavailable", async () => {
  state.connected = false;
  const { refreshOfficialMetrics } = await import("./recovery");
  await expect(refreshOfficialMetrics()).rejects.toThrow("database");
  expect(state.writes).toHaveLength(0);
});
