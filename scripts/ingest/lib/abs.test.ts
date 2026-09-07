import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAbsMetric, findReferenceDate, periodToDate } from "./abs";

const SCRAPE_URL = "https://www.abs.gov.au/statistics/thing/latest-release";

const scrape = {
  url: SCRAPE_URL,
  metricKey: "unemployment",
  label: "Unemployment rate",
  unit: "%",
  context: "ABS seasonally adjusted",
  groupKey: "LABOUR",
  displayOrder: 70,
  patterns: [/[Uu]nemployment rate[^0-9%]{0,200}?([0-9]+(?:\.[0-9]+)?)\s*%/],
};

const HTML = `<html><p>Reference period June 2026</p><p>Unemployment rate was 4.3 %</p></html>`;
const CSV = [
  "REGION,MEASURE,TIME_PERIOD,OBS_VALUE",
  "AUS,UNEMP,2026-05,4.1",
  "AUS,UNEMP,2026-06,4.2",
  "NSW,UNEMP,2026-06,3.9",
].join("\n");

/** Route by URL: the API host serves CSV, the release page serves HTML. */
function mockFetch(opts: { apiStatus?: number } = {}) {
  return vi.fn(async (url: string) => {
    if (String(url).includes("data.api.abs.gov.au")) {
      const status = opts.apiStatus ?? 200;
      return {
        ok: status === 200,
        status,
        statusText: status === 200 ? "OK" : "Not Found",
        text: async () => CSV,
      } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => HTML,
    } as unknown as Response;
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchAbsMetric", () => {
  it("scrapes when no API flow is configured", async () => {
    // Every metric ships in this state until its flow reference is confirmed,
    // so it has to keep working exactly as it does today.
    vi.stubGlobal("fetch", mockFetch());
    const result = await fetchAbsMetric({ scrape });
    expect(result?.value).toBe("4.3");
  });

  it("prefers the API when a flow is configured", async () => {
    vi.stubGlobal("fetch", mockFetch());
    const result = await fetchAbsMetric({
      api: { flowRef: "ABS,LF,1.0.0", dimensionFilter: { REGION: "AUS" } },
      scrape,
    });
    // Latest AUS observation, not the scraped 4.3.
    expect(result?.value).toBe("4.2");
  });

  it("dates the value from the observation's own period", async () => {
    // The whole point over scraping: no regex guessing at a release date.
    vi.stubGlobal("fetch", mockFetch());
    const result = await fetchAbsMetric({
      api: { flowRef: "ABS,LF,1.0.0", dimensionFilter: { REGION: "AUS" } },
      scrape,
    });
    expect(result?.asOf.toISOString().slice(0, 7)).toBe("2026-06");
  });

  it("falls back to the scrape when the API call fails", async () => {
    // This is what makes switching a metric over safe: a wrong flow reference
    // costs a log line, not the metric.
    vi.stubGlobal("fetch", mockFetch({ apiStatus: 404 }));
    const result = await fetchAbsMetric({ api: { flowRef: "ABS,WRONG,1.0.0" }, scrape });
    expect(result?.value).toBe("4.3");
  });

  it("falls back when the API returns data but nothing matches the filter", async () => {
    // A filter that matches nothing is a misconfiguration, not an empty market.
    vi.stubGlobal("fetch", mockFetch());
    const result = await fetchAbsMetric({
      api: { flowRef: "ABS,LF,1.0.0", dimensionFilter: { REGION: "NOWHERE" } },
      scrape,
    });
    expect(result?.value).toBe("4.3");
  });

  it("says so out loud when it falls back", async () => {
    // A silent fallback is how you end up believing you migrated something a
    // year after it quietly reverted.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", mockFetch({ apiStatus: 404 }));
    await fetchAbsMetric({ api: { flowRef: "ABS,WRONG,1.0.0" }, scrape });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("falling back to the scrape"));
    warn.mockRestore();
  });

  it("applies a format function to the API value", async () => {
    vi.stubGlobal("fetch", mockFetch());
    const result = await fetchAbsMetric({
      api: {
        flowRef: "ABS,LF,1.0.0",
        dimensionFilter: { REGION: "AUS" },
        format: (v) => v.toFixed(1),
      },
      scrape,
    });
    expect(result?.value).toBe("4.2");
  });

  it("scrapes when discovery is configured but the catalogue is unreachable", async () => {
    // Every metric ships in this state, and the catalogue is exactly the sort
    // of thing that is briefly unavailable. It must cost a log line, not a
    // metric.
    vi.stubGlobal("fetch", mockFetch({ apiStatus: 503 }));
    const result = await fetchAbsMetric({
      api: { discover: { terms: ["labour force"], expectRange: [2, 15] } },
      scrape,
    });
    expect(result?.value).toBe("4.3");
  });

  it("refuses a discovered flow whose latest value cannot be this metric", async () => {
    // The guard that makes automatic discovery safe. A flow can match a name
    // well and return perfectly good numbers for the wrong series; publishing
    // those under a right-looking label is worse than having no metric.
    const catalogue = {
      data: {
        dataflows: [{ id: "WRONG", agencyID: "ABS", version: "1.0.0", name: "Labour Force Index" }],
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("/dataflow/")) {
          return { ok: true, status: 200, json: async () => catalogue } as unknown as Response;
        }
        if (u.includes("data.api.abs.gov.au")) {
          // An index level, not a rate — plausible data, wrong series.
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            text: async () => "REGION,TIME_PERIOD,OBS_VALUE\nAUS,2026-06,137.2",
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => HTML,
        } as unknown as Response;
      })
    );
    const result = await fetchAbsMetric({
      api: { discover: { terms: ["labour force"], expectRange: [2, 15] } },
      scrape,
    });
    // Fell back to the scrape rather than publishing 137.2 as a rate.
    expect(result?.value).toBe("4.3");
  });
});

describe("ABS reference dates", () => {
  it.each(["unknown", "2026-13", "2026-Q5", "2026-02-30"])(
    "rejects invalid API period %s",
    (period) => expect(periodToDate(period)).toBeNull()
  );
  it("preserves explicit month and quarter API periods", () => {
    expect(periodToDate("2026-07")?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(periodToDate("2026-Q2")?.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });
  it("reads nested reference markup without substituting the release date", () => {
    expect(
      findReferenceDate(
        "<div>Reference period</div><div><span>July 2026</span></div>Released 26 August 2026"
      )?.toISOString()
    ).toBe("2026-07-01T00:00:00.000Z");
  });
  it.each([
    "Released 26 August 2026",
    "Reference period Mystery 2026",
    "Reference period 2026",
    "Service unavailable",
  ])("fails closed on %s", (html) => expect(findReferenceDate(html)).toBeNull());
});
