import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  prior: [] as any[],
  updates: [] as any[],
  inserts: [] as any[],
}));
vi.mock("./client", () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => state.prior }) }) }),
    update: () => ({
      set: (row: unknown) => {
        state.updates.push(row);
        return { where: async () => {} };
      },
    }),
    insert: () => ({
      values: async (row: unknown) => {
        state.inserts.push(row);
      },
    }),
  }),
}));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
import { upsertDailyMetric } from "./dailyMetrics";
const period = new Date("2025-12-31");
beforeEach(() => {
  state.prior = [
    { metricKey: "tas_population", value: "500000", previousValue: "490000", asOf: period },
  ];
  state.updates.length = 0;
  state.inserts.length = 0;
});
it("records successful refreshes of unchanged quarterly values without duplicating history", async () => {
  await upsertDailyMetric({
    metricKey: "tas_population",
    label: "TAS population",
    value: "500000",
    asOf: period,
  });
  expect(state.updates[0]).toMatchObject({
    value: "500000",
    previousValue: "490000",
    asOf: period,
    updatedAt: expect.any(Date),
  });
  expect(state.inserts).toHaveLength(0);
});
it("retains revisions and new reporting periods in history", async () => {
  await upsertDailyMetric({
    metricKey: "tas_population",
    label: "TAS population",
    value: "500100",
    asOf: period,
  });
  expect(state.inserts[0]).toMatchObject({ numericValue: 500100, recordedAt: period });
  expect(state.updates[0].previousValue).toBe("490000");
  await upsertDailyMetric({
    metricKey: "tas_population",
    label: "TAS population",
    value: "501000",
    asOf: new Date("2026-03-31"),
  });
  expect(state.updates[1].previousValue).toBe("500000");
  expect(state.inserts).toHaveLength(2);
});
