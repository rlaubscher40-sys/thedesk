import { beforeEach, expect, it, vi } from "vitest";
import type { TrpcContext } from "../core/context";
import { signalSnapshotSchema, type SignalSnapshot } from "../../shared/signalSnapshot";

const m = vi.hoisted(() => ({
  list: vi.fn(), histories: vi.fn(), editions: vi.fn(), store: vi.fn(), read: vi.fn(),
  number: vi.fn(), chart: vi.fn(), quota: vi.fn(),
}));
vi.mock("../db", () => ({ listDailyMetrics: m.list, listMetricHistories: m.histories,
  listEditionSummaries: m.editions, storeSignalSnapshot: m.store, readSignalSnapshot: m.read }));
vi.mock("../core/publicRender", () => ({ renderSignalCard: m.number, renderTrendCard: m.chart }));
vi.mock("../core/askQuota", () => ({ consumeAnonymousCard: m.quota }));
import { metricsRouter } from "./metrics";
import { signalsRouter } from "./signals";

const ctx = { user: null, req: { headers: {} }, res: {} } as TrpcContext;
const id = "a".repeat(64);
let saved: SignalSnapshot;
const metric = () => ({ metricKey: "cash_rate", label: "Cash rate", value: "4.35", unit: "%",
  source: "RBA", sourceUrl: "https://www.rba.gov.au/", context: "Stored rate", previousValue: "4.1",
  asOf: new Date("2026-07-01Z"), updatedAt: new Date("2026-07-02Z") });
beforeEach(() => {
  vi.clearAllMocks();
  m.list.mockResolvedValue([metric()]);
  m.histories.mockResolvedValue({ cash_rate: [
    { value: 4.1, recordedAt: new Date("2026-06-01Z") },
    { value: 4.35, recordedAt: new Date("2026-07-01Z") },
  ] });
  m.editions.mockResolvedValue([{ editionNumber: 7, rubensTake: "Original take" }]);
  m.number.mockResolvedValue(Buffer.from("image")); m.chart.mockResolvedValue(Buffer.from("chart"));
  m.quota.mockResolvedValue({ allowed: true });
  m.store.mockImplementation(async input => { saved = signalSnapshotSchema.parse(input); return id; });
  m.read.mockImplementation(async requested => requested === id ? saved : null);
});

it("freezes the Number's value, source, dates, history and attached edition", async () => {
  const first = await signalsRouter.createCaller(ctx).shareCard({ metricKey: "cash_rate" });
  expect(first.sharePath).toBe(`/signals?metric=cash_rate&snapshot=${id}`);
  const originalCard = structuredClone(m.number.mock.calls[0][0]);
  m.list.mockResolvedValue([{ ...metric(), value: "5", source: "Changed", asOf: new Date("2026-08-01Z") }]);
  m.editions.mockResolvedValue([{ editionNumber: 8, rubensTake: "New take" }]);
  m.histories.mockResolvedValue({ cash_rate: [] });
  const listCalls = m.list.mock.calls.length;
  const again = await signalsRouter.createCaller(ctx).shareCard({ metricKey: "cash_rate", snapshot: id });
  expect(m.number.mock.lastCall?.[0]).toEqual(originalCard);
  expect(again.sharePath).toBe(first.sharePath);
  expect(m.list).toHaveBeenCalledTimes(listCalls);
  expect(m.store).toHaveBeenCalledOnce();
  expect(await metricsRouter.createCaller(ctx).shared({ snapshot: id })).toMatchObject({
    metric: { value: "4.35", source: "RBA", asOf: new Date("2026-07-01Z") },
    deskTake: "Original take", editionNumber: 7,
  });
});

it("freezes chart points and re-renders them after live history disappears", async () => {
  const first = await metricsRouter.createCaller(ctx).shareTrendCard({ metricKey: "cash_rate" });
  expect(first.sharePath).toContain(`snapshot=${id}&view=chart`);
  const original = structuredClone(m.chart.mock.calls[0][0]);
  m.list.mockResolvedValue([]); m.histories.mockResolvedValue({});
  await metricsRouter.createCaller(ctx).shareTrendCard({ metricKey: "cash_rate", snapshot: id });
  expect(m.chart.mock.lastCall?.[0]).toEqual(original);
});

it("also pins the Trends number endpoint and preserves previous-value copy", async () => {
  const card = await metricsRouter.createCaller(ctx).shareCard({ metricKey: "cash_rate" });
  expect(card.sharePath).toContain(`snapshot=${id}`);
  expect(saved.move).toBe("Previous recorded value 4.1%");
  expect(saved.deskTake).toBeNull();
});

it("rejects unknown or mismatched snapshots without loading or rendering current data", async () => {
  await signalsRouter.createCaller(ctx).shareCard({ metricKey: "cash_rate" });
  m.list.mockClear(); m.number.mockClear(); m.chart.mockClear();
  await expect(signalsRouter.createCaller(ctx).shareCard({ metricKey: "cash_rate", snapshot: "b".repeat(64) })).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(metricsRouter.createCaller(ctx).shareTrendCard({ metricKey: "other", snapshot: id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(m.list).not.toHaveBeenCalled(); expect(m.number).not.toHaveBeenCalled(); expect(m.chart).not.toHaveBeenCalled();
});

it("does not return a share when persistence fails", async () => {
  m.store.mockRejectedValueOnce(new Error("database unavailable"));
  await expect(metricsRouter.createCaller(ctx).shareCard({ metricKey: "cash_rate" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
});

it("keeps render quotas before retrieval and rejects invalid snapshot IDs", async () => {
  m.quota.mockResolvedValue({ allowed: false, limit: 3 });
  await expect(signalsRouter.createCaller(ctx).shareCard({ metricKey: "cash_rate" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  expect(m.list).not.toHaveBeenCalled();
  await expect(metricsRouter.createCaller(ctx).shared({ snapshot: "invalid" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(m.read).not.toHaveBeenCalled();
});
