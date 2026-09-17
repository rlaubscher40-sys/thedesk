import { afterEach, expect, it, vi } from "vitest";
import { runDailyMetricsIngest } from "./dailyMetrics";

vi.mock("./lib/rbaCashRate", () => ({
  CASH_RATE_CSV: "https://www.rba.gov.au/statistics/tables/csv/f1-data.csv",
  fetchCashRate: async (report: (reason: string) => void) => {
    report("RBA F1 HTTP 403");
    return null;
  },
}));
vi.mock("./lib/auctionClearance", () => ({ fetchAuctionMetrics: async () => [] }));
vi.mock("./lib/propertyReleases", () => ({ fetchPropertyReleaseMetrics: async () => [] }));
vi.mock("./lib/rbaHousingRates", () => ({ fetchRbaHousingRateMetrics: async () => [] }));
vi.mock("./lib/abs", () => ({
  fetchAllAbs: async () => [
    {
      metricKey: "unemployment",
      label: "Unemployment rate",
      value: "4.3",
      unit: "%",
      source: "ABS",
      sourceUrl:
        "https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/latest-release",
      asOf: new Date("2026-07-01T00:00:00Z"),
      groupKey: "LABOUR",
      context: null,
      displayOrder: 70,
    },
  ],
}));
vi.mock("../../server/markets/absDemographics", () => ({
  getStateDemographics: async () => ({ status: "unavailable", observations: [] }),
}));
vi.mock("../../server/markets/absRents", () => ({
  getCityRents: async () => ({
    status: "available",
    retrievedAt: "2026-09-09T00:00:00Z",
    observations: [{ city: "Melbourne", period: "2026-07", annualPercent: 2.5, status: "" }],
  }),
}));
vi.mock("../../server/markets/absApprovals", () => ({
  getCityApprovals: async () => ({ status: "unavailable", observations: [] }),
}));
vi.mock("../../shared/stateDemographicMetrics", () => ({ stateDemographicMetrics: () => [] }));
vi.mock("./lib/post", () => ({
  postJSON: vi.fn(() => {
    throw new Error("Unexpected HTTP write");
  }),
}));

afterEach(() => vi.unstubAllGlobals());

it("forwards the cash-rate diagnosis while persisting successful sources without a model call", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: { regularMarketPrice: 1, regularMarketTime: 1788825600 },
                },
              ],
            },
          })
        )
    )
  );
  const persist = vi.fn(async () => {});
  const onSourceError = vi.fn();
  await runDailyMetricsIngest("", "", { persist, onSourceError, extractFromNews: false });
  expect(onSourceError).toHaveBeenCalledWith("cash_rate", "RBA F1 HTTP 403");
  expect(persist).toHaveBeenCalledOnce();
  const metrics = persist.mock.calls[0] as unknown as [Array<{ metricKey: string }>];
  expect(metrics[0]).toHaveLength(7);
  expect(metrics[0].find((m) => m.metricKey === "asx200")).toMatchObject({
    sourceUrl: "https://query1.finance.yahoo.com/v8/finance/chart/%5EAXJO?interval=1d&range=5d",
    asOf: "2026-09-08T00:00:00.000Z",
  });
  expect(metrics[0].find((m) => m.metricKey === "unemployment")).toMatchObject({
    sourceUrl:
      "https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/latest-release",
    asOf: "2026-07-01T00:00:00.000Z",
  });
  expect(metrics[0].find((m) => m.metricKey === "melbourne_rent_growth_annual")).toMatchObject({
    value: "2.5",
    unit: "%",
    asOf: "2026-07-01T00:00:00.000Z",
  });
  expect(metrics[0].some((metric) => metric.metricKey === "cash_rate")).toBe(false);
});
