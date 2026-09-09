import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  discoverRentWorkbook,
  getPublishedCityRents,
  parseRentWorkbook,
  rentWorkbookPeriod,
} from "./absRentWorkbook";
import { parseAbsRents } from "./absRents";
import { readWorkbook } from "../localData/workbook";
import { invalidate } from "../core/cache";
import { cityRentMetrics } from "../../shared/cityRentMetrics";
import { rankAskMetrics } from "../ask/metricRetrieval";
import { metricHealth } from "../../shared/metricHealth";
import type { DailyMetric } from "../db/schema";
import type { Sheet } from "../localData/parsers";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CityRentRead } from "../../shared/CityRentRead";

vi.mock("../localData/workbook", () => ({ readWorkbook: vi.fn() }));
const url =
  "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/jul-2026/6401011.xlsx";
const now = "2026-09-09T00:00:00Z";
// Actual Table 11 metadata and final two months, reduced to the rent columns.
const fixture = (): Sheet[] =>
  JSON.parse(
    readFileSync(new URL("./fixtures/abs-rents-table11.json", import.meta.url), "utf8"),
    (_key, value) =>
      typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value) ? new Date(value) : value
  );
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
  invalidate("abs:rents:");
});

describe("published ABS rent fallback", () => {
  it("preserves zero and negative annual rates and renders dated workbook citations", () => {
    const sheets = fixture();
    sheets[0]!.data[11]![1] = sheets[0]!.data[11]![2] = 0;
    sheets[0]!.data[11]![3] = sheets[0]!.data[11]![4] = -0.2;
    const data = parseRentWorkbook(sheets, url, now);
    expect(
      cityRentMetrics(data)
        .slice(0, 2)
        .map((m) => m.value)
    ).toEqual(["0.0", "-0.2"]);
    const html = renderToStaticMarkup(
      React.createElement(CityRentRead, { data, marketA: "Melbourne", asOf: now })
    );
    expect(html).toContain("Year to July 2026");
    expect(html).toContain(url);
    expect(html).toContain("Source observations (XLSX)");
    expect(html).toContain("-0.2");
  });
  it("agrees with independently downloaded SDMX observations for every city and month", () => {
    const data = parseRentWorkbook(fixture(), url, now);
    const api = parseAbsRents(
      readFileSync(new URL("./fixtures/abs-rents.csv", import.meta.url), "utf8"),
      now
    );
    const ordered = (rows: typeof data.observations) =>
      [...rows].sort((a, b) => `${a.city}${a.period}`.localeCompare(`${b.city}${b.period}`));
    expect(data.observations).toHaveLength(16);
    expect(ordered(data.observations)).toEqual(ordered(api.observations));
    expect(data).toMatchObject({ sourceUrl: url, delivery: "workbook" });
  });
  it("discovers only the unique official Table 11 URL for a completed month", () => {
    expect(discoverRentWorkbook(`<a href="${url}">xlsx</a><a href="${url}">repeat</a>`, now)).toBe(
      url
    );
    expect(() =>
      discoverRentWorkbook(
        `<a href="${url}">a</a><a href="${url.replace("jul-2026", "jun-2026")}">b</a>`,
        now
      )
    ).toThrow();
    expect(() =>
      discoverRentWorkbook(`<a href="${url.replace("jul-2026", "sep-2026")}">a</a>`, now)
    ).toThrow();
    for (const bad of [
      url.replace("www.abs.gov.au", "evil.example"),
      url.replace("6401011", "6401010"),
      url + "?x=1",
      url.replace("https:", "http:"),
    ])
      expect(() => rentWorkbookPeriod(bad)).toThrow();
  });
  it.each([null, "2.5p", "", 9.9])(
    "withholds a missing, flagged or conflicting latest city value (%s)",
    (value) => {
      const sheets = fixture();
      sheets[0]!.data[11]![4] = value;
      expect(
        parseRentWorkbook(sheets, url, now).observations.some((r) => r.city === "Melbourne")
      ).toBe(false);
    }
  );
  it("rejects changed geography, units, series IDs and release periods", () => {
    for (const [r, c, value] of [
      [0, 3, "Annual rents ; Victoria ;"],
      [1, 3, "Index"],
      [9, 3, "UNKNOWN"],
    ] as const) {
      const sheets = fixture();
      sheets[0]!.data[r]![c] = value;
      expect(() => parseRentWorkbook(sheets, url, now)).toThrow();
    }
    expect(() => parseRentWorkbook(fixture(), url.replace("jul-2026", "jun-2026"), now)).toThrow();
    const duplicate = fixture();
    duplicate.push(duplicate[0]!);
    expect(() => parseRentWorkbook(duplicate, url, now)).toThrow();
  });
  it("carries original periods and sources into stored metrics, Ask and Admin", () => {
    const data = parseRentWorkbook(fixture(), url, now);
    const rows = cityRentMetrics(data).map((m, i) => ({
      ...m,
      id: i,
      previousValue: null,
      asOf: new Date(m.asOf),
      updatedAt: new Date(now),
    })) as DailyMetric[];
    expect(rows).toHaveLength(8);
    expect(
      rankAskMetrics("How fast are Melbourne rents rising?", rows).map((r) => r.metricKey)
    ).toEqual(["melbourne_rent_growth_annual"]);
    for (const question of [
      "Victoria rent growth",
      "Geelong rents",
      "Melbourne median weekly rent",
      "Carlton suburb Melbourne rents",
      "Melbourne vacancy rate",
      "Darwin postcode rents",
    ])
      expect(rankAskMetrics(question, rows)).toEqual([]);
    expect(
      rankAskMetrics("Compare Canberra and Darwin rents", rows)
        .map((r) => r.metricKey)
        .sort()
    ).toEqual(["canberra_rent_growth_annual", "darwin_rent_growth_annual"]);
    expect(rows[1]).toMatchObject({
      value: "2.5",
      sourceUrl: url,
      asOf: new Date("2026-07-01T00:00:00Z"),
    });
    expect(
      metricHealth(rows, new Date(now)).find((r) => r.key === "melbourne_rent_growth_annual")?.state
    ).toBe("within review window");
    expect(
      metricHealth(rows, new Date("2026-12-01")).find(
        (r) => r.key === "melbourne_rent_growth_annual"
      )?.state
    ).toBe("old reporting period");
  });
  it("discovers before downloading and reuses an unchanged release", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(`<a href="${url}">file</a>`))
      .mockResolvedValueOnce(new Response("workbook"))
      .mockResolvedValueOnce(new Response(`<a href="${url}">file</a>`));
    vi.stubGlobal("fetch", fetcher);
    vi.mocked(readWorkbook).mockResolvedValue(fixture());
    expect((await getPublishedCityRents()).observations).toHaveLength(16);
    await getPublishedCityRents();
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(readWorkbook).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[1]?.[0]).toBe(url);
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({ redirect: "error" });
  });
  it("rejects oversized streamed workbooks before parsing", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(`<a href="${url}">file</a>`))
        .mockResolvedValueOnce(new Response("x".repeat(1_000_001)))
    );
    await expect(getPublishedCityRents()).rejects.toThrow("too large");
    expect(readWorkbook).not.toHaveBeenCalled();
  });
});
