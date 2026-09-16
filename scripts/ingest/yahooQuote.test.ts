import { afterEach, expect, it, vi } from "vitest";
import { fetchYahooQuote } from "./dailyMetrics";

function response(result: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ chart: { result: [result] } })))
  );
}
afterEach(() => vi.unstubAllGlobals());

it("does not make an undated market quote appear fresh", async () => {
  response({ meta: { regularMarketPrice: 8123 } });
  expect(await fetchYahooQuote("^AXJO")).toBeNull();
});

it("pairs the last valid close with its own timestamp when a later close is missing", async () => {
  response({
    meta: { regularMarketPrice: 9000 },
    timestamp: [1788825600, 1788912000],
    indicators: { quote: [{ close: [8100, null] }] },
  });
  expect(await fetchYahooQuote("^AXJO")).toEqual({
    price: 8100,
    asOf: new Date("2026-09-08T00:00:00Z"),
    sourceUrl: "https://query1.finance.yahoo.com/v8/finance/chart/%5EAXJO?interval=1d&range=5d",
  });
});

it.each([0, -1, 1e20, 9999999999])(
  "rejects invalid or future market timestamps: %s",
  async (timestamp) => {
    response({ meta: { regularMarketPrice: 8123, regularMarketTime: timestamp } });
    expect(await fetchYahooQuote("^AXJO")).toBeNull();
  }
);
