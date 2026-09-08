import { afterEach, expect, it, vi } from "vitest";
import { runDailyMetricsIngest } from "./dailyMetrics";

vi.mock("./lib/rbaCashRate", () => ({
  CASH_RATE_CSV: "https://www.rba.gov.au/statistics/tables/csv/f1-data.csv",
  fetchCashRate: async (report: (reason: string) => void) => {
    report("RBA F1 HTTP 403");
    return null;
  },
}));
vi.mock("./lib/rbaHousingRates", () => ({ fetchRbaHousingRateMetrics: async () => [] }));
vi.mock("./lib/abs", () => ({ fetchAllAbs: async () => [] }));
vi.mock("../../server/markets/absDemographics", () => ({
  getStateDemographics: async () => ({ status: "unavailable", observations: [] }),
}));
vi.mock("../../server/markets/absApprovals", () => ({
  getCityApprovals: async () => ({ status: "unavailable", observations: [] }),
}));
vi.mock("../../shared/stateDemographicMetrics", () => ({ stateDemographicMetrics: () => [] }));
vi.mock("./lib/post", () => ({ postJSON: vi.fn(() => { throw new Error("Unexpected HTTP write"); }) }));

afterEach(() => vi.unstubAllGlobals());

it("forwards the cash-rate diagnosis while persisting successful sources without a model call", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ chart: { result: [{
    meta: { regularMarketPrice: 1, regularMarketTime: 1788825600 },
  }] } }))));
  const persist = vi.fn(async () => {});
  const onSourceError = vi.fn();
  await runDailyMetricsIngest("", "", { persist, onSourceError, extractFromNews: false });
  expect(onSourceError).toHaveBeenCalledWith("cash_rate", "RBA F1 HTTP 403");
  expect(persist).toHaveBeenCalledOnce();
  const metrics = persist.mock.calls[0] as unknown as [Array<{ metricKey: string }>];
  expect(metrics[0]).toHaveLength(5);
  expect(metrics[0].some((metric) => metric.metricKey === "cash_rate")).toBe(false);
});
