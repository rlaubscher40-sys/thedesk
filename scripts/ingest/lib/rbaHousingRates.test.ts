import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchRbaHousingRateMetrics,
  F6_SOURCE_URL,
  housingRateMetrics,
  parseRbaHousingRates,
} from "./rbaHousingRates";

const OWNER_TITLE =
  "Lending rates; Housing credit; New loans funded in the month; Owner-occupied; All loans; All institutions";
const INVESTOR_TITLE =
  "Lending rates; Housing credit; New loans funded in the month; Investment; All loans; All institutions";

const CSV = [
  "\uFEFFF6 - HOUSING LENDING RATES",
  `Title,${OWNER_TITLE},${INVESTOR_TITLE}`,
  `Description,${OWNER_TITLE},${INVESTOR_TITLE}`,
  "Frequency,Monthly,Monthly",
  "Type,Original,Original",
  "Units,Per cent per annum,Per cent per annum",
  'Source,"APRA, RBA","APRA, RBA"',
  "Publication date,07-Sep-2026,07-Sep-2026",
  "Series ID,FLRHOFTA,FLRHIFTA",
  "30/06/2026,6.2,6.3",
  "31/07/2026,6.2,6.4",
].join("\r\n");

afterEach(() => vi.unstubAllGlobals());

describe("RBA F6 housing lending rates", () => {
  it("pins the two all-institutions new-loan series and their own period", () => {
    const rates = parseRbaHousingRates(CSV, new Date("2026-09-08T00:00:00Z"));
    expect(rates).toEqual([
      expect.objectContaining({ seriesId: "FLRHOFTA", rate: 6.2 }),
      expect.objectContaining({ seriesId: "FLRHIFTA", rate: 6.4 }),
    ]);
    expect(rates[0]!.period.toISOString()).toBe("2026-07-31T00:00:00.000Z");
    expect(rates[0]!.publicationDate.toISOString()).toBe("2026-09-07T00:00:00.000Z");
  });

  it.each([
    ["F6 - HOUSING LENDING RATES", "F5 - INDICATOR LENDING RATES"],
    ["FLRHOFTA", "FLRHOFTL"],
    [OWNER_TITLE, OWNER_TITLE.replace("All institutions", "Large institutions")],
    ["Monthly,Monthly", "Quarterly,Monthly"],
    ["Original,Original", "Seasonally adjusted,Original"],
    ["Per cent per annum,Per cent per annum", "Index,Per cent per annum"],
    ['"APRA, RBA","APRA, RBA"', '"RBA","APRA, RBA"'],
  ])("rejects a changed table or series identity", (before, after) => {
    expect(() =>
      parseRbaHousingRates(CSV.replace(before, after), new Date("2026-09-08"))
    ).toThrow();
  });

  it("uses the latest table row and never backfills its missing value", () => {
    const missing = CSV.replace("31/07/2026,6.2,6.4", "31/07/2026,,6.4");
    expect(() => parseRbaHousingRates(missing, new Date("2026-09-08"))).toThrow(
      "Current RBA F6 observation unavailable"
    );
  });

  it.each([
    ["31/07/2026,6.2,6.4", "31/07/2026,-1,6.4"],
    ["31/07/2026,6.2,6.4", "31/07/2026,31,6.4"],
    ["31/07/2026,6.2,6.4", "31/02/2026,6.2,6.4"],
    ["Publication date,07-Sep-2026,07-Sep-2026", "Publication date,07-Sep-2026,08-Sep-2026"],
  ])("rejects malformed, implausible or mismatched current observations", (before, after) => {
    expect(() =>
      parseRbaHousingRates(CSV.replace(before, after), new Date("2026-09-08"))
    ).toThrow();
  });

  it("withholds stale and future observations", () => {
    expect(() => parseRbaHousingRates(CSV, new Date("2027-01-01"))).toThrow("Stale");
    expect(() => parseRbaHousingRates(CSV, new Date("2026-07-01"))).toThrow("future");
  });

  it("emits explicit, sourced property metrics without a causal claim", () => {
    const metrics = housingRateMetrics(parseRbaHousingRates(CSV, new Date("2026-09-08T00:00:00Z")));
    expect(metrics[0]).toMatchObject({
      metricKey: "owner_occupier_new_lending_rate",
      value: "6.2",
      unit: "%",
      source: "RBA / APRA",
      sourceUrl: F6_SOURCE_URL,
      groupKey: "PROPERTY",
      asOf: "2026-07-31T00:00:00.000Z",
    });
    expect(metrics[1]).toMatchObject({ metricKey: "investor_new_lending_rate", value: "6.4" });
    expect(metrics[0]!.context).toContain("RBA F6 FLRHOFTA");
    expect(metrics[0]!.context).toContain("all institutions; original series");
    expect(metrics[0]!.context).toContain("RBA tables may be revised");
    expect(metrics[0]!.context).not.toMatch(/because|caused|therefore/iu);
  });

  it("fails closed on transport, parse and oversized responses", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const response of [
      new Response("no", { status: 503 }),
      new Response("<html>wrong</html>", { status: 200 }),
      new Response(CSV, { status: 200, headers: { "content-length": "256001" } }),
    ]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response));
      await expect(fetchRbaHousingRateMetrics()).resolves.toEqual([]);
    }
    warn.mockRestore();
  });
});
