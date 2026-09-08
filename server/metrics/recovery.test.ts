import { beforeEach, expect, it, vi } from "vitest";
import { METRIC_EXPECTATIONS } from "../../shared/metricHealth";
import {
  isAuctionCollectionPaused,
  PAUSED_AUCTION_KEYS,
} from "../../shared/auctionCollectionPolicy";
const state = vi.hoisted(() => ({
  metrics: [] as any[],
  writes: [] as any[],
  connected: true,
  sourceError: "",
  completeActive: false,
  failWrites: true,
}));
vi.mock("../db/client", () => ({ getDb: () => (state.connected ? {} : null) }));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
vi.mock("../db/dailyMetrics", () => ({
  listDailyMetrics: async () => state.metrics,
  upsertDailyMetric: vi.fn(async (row) => {
    state.writes.push(row);
    if (state.failWrites && row.metricKey === "audusd")
      throw new Error("write failed");
  }),
}));
vi.mock("../../scripts/ingest/dailyMetrics", () => ({
  runDailyMetricsIngest: vi.fn(async (_base, _key, options) => {
    expect(options.extractFromNews).toBe(false);
    if (state.completeActive) {
      options.onSourceError?.(
        "auction_clearance",
        "Auction collection is paused pending approved access",
      );
      await options.persist(
        METRIC_EXPECTATIONS.filter(
          (row) => !isAuctionCollectionPaused(row.key),
        ).map((row) => ({
          metricKey: row.key,
          label: row.label,
          value: "1",
          asOf: new Date().toISOString(),
        })),
      );
      return;
    }
    if (state.sourceError)
      options.onSourceError?.("cash_rate", state.sourceError);
    await options.persist([
      ...(state.sourceError
        ? []
        : [
            {
              metricKey: "cash_rate",
              label: "RBA",
              value: "4.35",
              asOf: "2026-09-07T00:00:00Z",
            },
          ]),
      {
        metricKey: "audusd",
        label: "AUD",
        value: "0.65",
        asOf: "2026-09-07T00:00:00Z",
      },
    ]);
  }),
}));
beforeEach(() => {
  vi.resetModules();
  state.metrics = [];
  state.writes = [];
  state.connected = true;
  state.sourceError = "";
  state.completeActive = false;
  state.failWrites = true;
  vi.clearAllMocks();
});

it("carries the cash-rate failure reason into Admin and the scheduler error", async () => {
  state.sourceError = "RBA F1 HTTP 403";
  const { refreshOfficialMetrics, metricRefreshStatus, recoverMissingMetrics } =
    await import("./recovery");
  const report = await refreshOfficialMetrics();
  expect(report.sourceErrors).toEqual([
    { metricKey: "cash_rate", reason: "RBA F1 HTTP 403" },
  ]);
  expect(report.unavailable).toContain("cash_rate");
  expect(metricRefreshStatus().lastReport?.sourceErrors).toEqual(
    report.sourceErrors,
  );
  await expect(recoverMissingMetrics()).rejects.toThrow(
    "cash_rate: RBA F1 HTTP 403",
  );
});

it("bounds source diagnostics in the refresh report", async () => {
  state.sourceError = "x".repeat(1000);
  const { refreshOfficialMetrics } = await import("./recovery");
  expect((await refreshOfficialMetrics()).sourceErrors[0]!.reason).toHaveLength(
    400,
  );
});

it("collects missing metrics directly and reports missing sources separately from failed writes", async () => {
  const { refreshOfficialMetrics, metricRefreshStatus } =
    await import("./recovery");
  const report = await refreshOfficialMetrics();
  expect(report.stored).toBe(1);
  expect(report.failedWrites).toEqual(["audusd"]);
  expect(report.unavailable).toContain("tas_population");
  expect(report.unavailable).not.toContain("audusd");
  expect(report.unavailable).toContain("auction_clearance");
  expect(report.unavailable).toContain("consumer_confidence");
  expect(report.unavailable).toContain("dwelling_value");
  expect(report.unavailable).toContain("mortgage_arrears");
  expect(report.unavailable).toContain("tas_auction_clearance");
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
  await expect(recoverMissingMetrics()).rejects.toThrow(
    "Metric refresh stored 1",
  );
});
it("rejects collection before contacting sources when storage is unavailable", async () => {
  state.connected = false;
  const { refreshOfficialMetrics } = await import("./recovery");
  await expect(refreshOfficialMetrics()).rejects.toThrow("database");
  expect(state.writes).toHaveLength(0);
});

it("does not trigger recovery solely for intentionally paused auction gaps", async () => {
  state.metrics = METRIC_EXPECTATIONS.filter(
    (row) => !isAuctionCollectionPaused(row.key),
  ).map((row) => ({
    metricKey: row.key,
    label: row.label,
    asOf: new Date(new Date().toISOString().slice(0, 10)),
    updatedAt: new Date(),
    source: "Fixture",
  }));
  const { needsMetricRecovery, recoverMissingMetrics } =
    await import("./recovery");
  expect(await needsMetricRecovery()).toBe(false);
  await recoverMissingMetrics();
  expect(state.writes).toHaveLength(0);
  state.metrics = state.metrics.filter((row) => row.metricKey !== "cash_rate");
  expect(await needsMetricRecovery()).toBe(true);
});

it("recovers active metrics without exhausting retries for paused auctions, but keeps Admin gaps visible", async () => {
  state.completeActive = true;
  state.failWrites = false;
  const { recoverMissingMetrics, metricRefreshStatus } =
    await import("./recovery");
  await expect(recoverMissingMetrics()).resolves.toBeUndefined();
  const report = metricRefreshStatus().lastReport!;
  expect(report.unavailable).toEqual(PAUSED_AUCTION_KEYS);
  expect(report.sourceErrors[0]?.reason).toContain("paused");
  expect(report.stored).toBe(METRIC_EXPECTATIONS.length - 9);
});

it("still fails recovery for a storage error even when the only missing sources are paused", async () => {
  state.completeActive = true;
  const { recoverMissingMetrics } = await import("./recovery");
  await expect(recoverMissingMetrics()).rejects.toThrow(
    "failed writes: audusd",
  );
});
