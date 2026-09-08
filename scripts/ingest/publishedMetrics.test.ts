import { describe, expect, it, vi, afterEach } from "vitest";
import {
  AUCTION_REGIONS,
  nationalAuctionResult,
} from "../../shared/auctionClearance";
import {
  parseAuctionResults,
  createAuctionCollector,
} from "./lib/auctionClearance";
import {
  parseSentiment,
  parseDwellingTable,
  fetchPropertyReleaseMetrics,
} from "./lib/propertyReleases";
import { parseCbaArrears } from "./lib/mortgageArrears";
import { sourceHtml } from "./lib/publishedSources";

const now = new Date("2026-09-08T12:00:00Z");
const auction = (region = "NSW", sold = 3, total = 5) => `<main>
Mon 31 Aug 2026 - Sun 06 Sep 2026 <h2>${region} clearance rate*</h2>
Based on <b>${total}</b> auction results available
<div>${sold}</div><div>Sold at auction</div> 0 Sold prior to auction 0 Sold after auction
${total - sold} Withdrawn 0 Passed in ${total + 2} auctions scheduled
Non-auction sales 99 Private sales</main>`;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("state and national auctions", () => {
  it("reads statewide counts, excludes private sales and uses the source week", () => {
    expect(parseAuctionResults(auction(), "NSW", now)).toEqual({
      region: "NSW",
      weekEnding: "2026-09-06",
      sold: 3,
      reported: 5,
      scheduled: 7,
    });
  });
  it.each([
    ["wrong geography", auction("VIC")],
    ["missing count", auction().replace("0 Passed in", "Passed in")],
    ["unreconciled count", auction().replace("2 Withdrawn", "3 Withdrawn")],
    [
      "duplicate summary",
      auction().replace(
        "Non-auction sales",
        "3 Sold at auction Non-auction sales",
      ),
    ],
    [
      "stale",
      auction()
        .replaceAll("Aug 2026", "Aug 2025")
        .replaceAll("Sep 2026", "Sep 2025"),
    ],
    ["wrong week", auction().replace("31 Aug", "30 Aug")],
  ])("rejects %s", (_name, html) =>
    expect(() => parseAuctionResults(html, "NSW", now)).toThrow(),
  );
  it("uses counts rather than a simple mean and includes known zero-auction states", () => {
    const rows = AUCTION_REGIONS.map((region, i) => ({
      region,
      weekEnding: "2026-09-06",
      sold: i === 0 ? 90 : i === 1 ? 1 : 0,
      reported: i === 0 ? 100 : i === 1 ? 10 : 0,
      scheduled: i === 0 ? 120 : i === 1 ? 20 : 0,
    }));
    expect(nationalAuctionResult(rows)?.rate).toBeCloseTo(82.727272);
    expect(nationalAuctionResult(rows)?.reported).toBe(110);
    expect(nationalAuctionResult(rows.slice(1))).toBeNull();
    expect(nationalAuctionResult([...rows.slice(1), rows[1]!])).toBeNull();
    expect(
      nationalAuctionResult(
        rows.map((r, i) => ({
          ...r,
          weekEnding: i === 0 ? "2026-08-30" : r.weekEnding,
        })),
      ),
    ).toBeNull();
  });
  it("does not turn an empty week into a zero-percent national clearance", () => {
    const rows = AUCTION_REGIONS.map((region) => ({
      region,
      weekEnding: "2026-09-06",
      sold: 0,
      reported: 0,
      scheduled: 0,
    }));
    expect(nationalAuctionResult(rows)?.rate).toBeNull();
  });
  it("collects all eight plus Australia and flags small samples", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: URL) =>
          new Response(auction(url.pathname.split("/").pop()!.toUpperCase())),
      ),
    );
    const rows = await createAuctionCollector({ delay: async () => {} })();
    expect(rows).toHaveLength(9);
    expect(
      rows.find((row) => row.metricKey === "auction_clearance")?.value,
    ).toBe("60.0");
    expect(
      rows.find((row) => row.metricKey === "tas_auction_clearance")?.context,
    ).toContain("Small sample");
  });
  it("keeps good states and diagnoses a missing state and national total", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: URL) =>
          new Response(auction(url.pathname.split("/").pop()!.toUpperCase()), {
            status: url.pathname.endsWith("tas") ? 503 : 200,
          }),
      ),
    );
    const error = vi.fn();
    const rows = await createAuctionCollector({ delay: async () => {} })(error);
    expect(rows).toHaveLength(7);
    expect(rows.some((row) => row.metricKey === "auction_clearance")).toBe(
      false,
    );
    expect(error).toHaveBeenCalledWith(
      "tas_auction_clearance",
      expect.stringContaining("503"),
    );
    expect(error).toHaveBeenCalledWith(
      "auction_clearance",
      expect.stringContaining("same week"),
    );
  });
});

describe("published releases", () => {
  const sentiment =
    '<meta content="Westpac–Melbourne Institute Consumer Sentiment Index declined 5.2% to 84.4 in September from 88.9 in August."><script>{"datePublished":"2026-09-08T10:42:24+11:00"}</script>';
  it("selects the headline sentiment level, not the percent change or prior month", () => {
    expect(parseSentiment(sentiment, now)).toEqual({
      value: "84.4",
      asOf: "2026-09-01",
    });
  });
  it.each([
    sentiment.replace("Consumer Sentiment", "Unemployment Expectations"),
    sentiment.replace("September from", "August from"),
    sentiment.replace("datePublished", "missingDate"),
  ])("rejects ungrounded sentiment", (html) =>
    expect(() => parseSentiment(html, now)).toThrow(),
  );
  const table = (label = "National", header = "Median value") =>
    `<script>window.infographicData=${JSON.stringify({
      title: "2609 HVI September (Aug data) WEB",
      elements: [
        {
          data: [
            [
              [null, { value: header }],
              [{ value: "Combined capitals" }, { value: "$990,394" }],
              [{ value: label }, { value: "$912,885" }],
            ],
          ],
        },
      ],
    })};</script>`;
  it("selects the national median column and actual data month", () => {
    expect(parseDwellingTable(table(), now)).toEqual({
      value: "$912,885",
      asOf: "2026-08-31",
    });
  });
  it("discovers and follows the publisher's HVI iframe rather than relying on news headlines", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) => {
        if (url.pathname.endsWith("all-insights"))
          return new Response(
            '<a href="/au/insights/articles/housing-values">Latest release</a>',
          );
        if (url.pathname.endsWith("housing-values"))
          return new Response(
            '<iframe src="https://e.infogram.com/4d8aab62-9818-4599-92e0-6721b057f18b?src=embed"></iframe>',
          );
        if (url.hostname === "e.infogram.com") return new Response(table());
        return new Response(null, { status: 404 });
      }),
    );
    const rows = await fetchPropertyReleaseMetrics();
    expect(
      rows.find((row) => row.metricKey === "dwelling_value"),
    ).toMatchObject({
      value: "$912,885",
      asOf: "2026-08-31",
      sourceUrl: "https://www.cotality.com/au/insights/articles/housing-values",
    });
  });
  it.each([
    table("Sydney"),
    table("National", "Mean value"),
    table().replace("(Aug data)", "(Jul data)"),
    table().replace("2609", "2509"),
  ])("rejects wrong dwelling measure or period", (html) =>
    expect(() => parseDwellingTable(html, now)).toThrow(),
  );
  const arrears =
    "Commonwealth Bank of Australia For the full year ended 30 June 2026. Home loan 90+ day arrears were 0.73%, compared with prior half. Personal loan arrears were 1.72%.";
  it("extracts the named bank's exact 90+ day home-loan measure", () => {
    expect(parseCbaArrears(arrears, now)).toEqual({
      value: "0.73",
      asOf: "2026-06-30",
    });
  });
  it.each([
    arrears.replace("Home loan 90+ day arrears", "Non-performing loans"),
    arrears.replace("Home loan", "Personal loan"),
    arrears.replace("June 2026", "June 2025"),
  ])("rejects other arrears definitions and stale data", (text) =>
    expect(() => parseCbaArrears(text, now)).toThrow(),
  );
  it("rejects redirects away from approved publishers", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1/admin" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      sourceHtml("https://www.cotality.com/au/insights/all-insights"),
    ).rejects.toThrow("Unsupported");
    expect(fetch).toHaveBeenCalledOnce();
  });
});
