import { describe, expect, it } from "vitest";
import type { DailyMetric } from "../db/schema";
import { askMetricTerms, displayMetricValue, rankAskMetrics } from "./metricRetrieval";
import { PROPERTY_REGIONS } from "../../shared/propertyCoverage";

function metric(overrides: Partial<DailyMetric>): DailyMetric {
  return {
    id: 1,
    metricKey: "cash_rate",
    label: "Cash rate",
    value: "4.10",
    unit: "%",
    previousValue: "4.35",
    source: "RBA",
    context: "Official cash rate target",
    groupKey: "MACRO",
    sourceUrl: "https://www.rba.gov.au/",
    asOf: new Date("2026-09-01T00:00:00Z"),
    displayOrder: 10,
    updatedAt: new Date("2026-09-01T00:00:00Z"),
    ...overrides,
  } as DailyMetric;
}

const metrics = [
  metric({ id: 1 }),
  metric({
    id: 2,
    metricKey: "investor_lending",
    label: "Investor lending",
    value: "24.8",
    unit: "$bn",
    previousValue: "23.9",
    source: "ABS",
    context: "New investor housing loan commitments",
    groupKey: "PROPERTY",
    displayOrder: 20,
  }),
  metric({
    id: 3,
    metricKey: "vacancy_rate",
    label: "Rental vacancy rate",
    value: "1.2%",
    unit: "%",
    previousValue: "1.3%",
    source: "SQM Research",
    context: "National rental vacancy",
    groupKey: "PROPERTY",
    displayOrder: 30,
  }),
  metric({
    id: 4,
    metricKey: "unemployment_rate",
    label: "Unemployment rate",
    value: "4.2",
    unit: "%",
    previousValue: "4.1",
    source: "ABS",
    context: "National labour force",
    groupKey: "LABOUR",
    displayOrder: 40,
  }),
];

describe("Ask metric retrieval", () => {
  const stateMetrics = PROPERTY_REGIONS.flatMap((region, index) => [
    metric({
      metricKey: `${region.code.toLowerCase()}_population`,
      label: `${region.code} population`,
      context: `${region.name}. Whole state population, not a city or suburb estimate.`,
      groupKey: "DEMOGRAPHICS",
      displayOrder: 150 + index * 4,
    }),
    metric({
      metricKey: `${region.code.toLowerCase()}_net_overseas_migration_12m`,
      label: `${region.code} net overseas migration`,
      context: `${region.name}. Net overseas migration over four quarters.`,
      groupKey: "DEMOGRAPHICS",
      displayOrder: 151 + index * 4,
    }),
  ]);

  it("retrieves the named city's state context before the nationwide metric cap", () => {
    expect(
      rankAskMetrics("What is happening with Hobart population?", stateMetrics).map(
        (row) => row.metricKey
      )
    ).toEqual(["tas_population", "tas_net_overseas_migration_12m"]);
    expect(
      rankAskMetrics("Compare nsw and wa population", stateMetrics)
        .map((row) => row.metricKey)
        .sort()
    ).toEqual(
      [
        "nsw_population",
        "nsw_net_overseas_migration_12m",
        "wa_population",
        "wa_net_overseas_migration_12m",
      ].sort()
    );
  });

  it("requires a topic match as well as a state match", () => {
    expect(rankAskMetrics("What is happening with NSW rents?", stateMetrics)).toEqual([]);
    expect(rankAskMetrics("South Australia rental vacancy", stateMetrics)).toEqual([]);
  });

  it("does not substitute capital-city approvals for a regional city", () => {
    const approvals = metric({
      metricKey: "brisbane_approvals_12m",
      label: "Brisbane approvals (12m)",
      context: "Greater Brisbane. Approved dwellings over 12 months.",
      groupKey: "PROPERTY",
    });
    expect(rankAskMetrics("Townsville building approvals", [approvals])).toEqual([]);
    expect(rankAskMetrics("Queensland building approvals", [approvals])).toEqual([approvals]);
    expect(rankAskMetrics("Brisbane building approvals", [approvals])).toEqual([approvals]);
  });

  it("does not offer unemployment or vacancy rates for an interest-rate question", () => {
    const keys = rankAskMetrics("What is the current investor interest rate?", metrics).map(
      (row) => row.metricKey
    );
    expect(keys).toContain("cash_rate");
    expect(keys).not.toContain("unemployment_rate");
    expect(keys).not.toContain("vacancy_rate");
  });

  it("does not expand a rental or unemployment rate question into interest rates", () => {
    expect(
      rankAskMetrics("What is the unemployment rate?", metrics).map((row) => row.metricKey)
    ).toEqual(["unemployment_rate"]);
    expect(
      rankAskMetrics("What is the rental vacancy rate?", metrics).map((row) => row.metricKey)
    ).toEqual(["vacancy_rate"]);
  });

  it("does not treat current as rent or rate as a corporate substring", () => {
    const unrelated = metric({
      metricKey: "corporate_profit",
      label: "Corporate profits",
      context: "Current company outlook",
      groupKey: "EQUITIES",
    });
    expect(rankAskMetrics("rental rate", [unrelated])).toEqual([]);
    expect(rankAskMetrics("current Townsville outlook", metrics)).toEqual([]);
  });

  it("ranks an exact lending metric ahead of unrelated dashboard rows", () => {
    const ranked = rankAskMetrics("What is changing in investor lending?", metrics);
    expect(ranked[0]?.metricKey).toBe("investor_lending");
    expect(ranked.some((row) => row.metricKey === "unemployment_rate")).toBe(false);
  });

  it("uses retrieval synonyms without treating them as new evidence", () => {
    const ranked = rankAskMetrics("What is happening with housing credit?", metrics);
    expect(ranked.some((row) => row.metricKey === "investor_lending")).toBe(true);
    expect(askMetricTerms("housing credit")).toContain("lending");
  });

  it("can retrieve property metrics for a broad property question", () => {
    const ranked = rankAskMetrics("What is changing in the property market?", metrics);
    expect(ranked.map((row) => row.groupKey)).toContain("PROPERTY");
  });

  it("does not inject unrelated metrics when there is no lexical match", () => {
    const ranked = rankAskMetrics("What does The Desk know about Townsville?", metrics);
    expect(ranked).toEqual([]);
  });

  it("formats units without duplicating percentage symbols", () => {
    expect(displayMetricValue("1.2%", "%")).toBe("1.2%");
    expect(displayMetricValue("4.10", "%")).toBe("4.10%");
    expect(displayMetricValue("24.8", "$bn")).toBe("24.8 $bn");
    expect(displayMetricValue("$815,439", "$")).toBe("$815,439");
  });
});

it("prioritises the requested state's auction rate and the weighted Australia rate for national questions", () => {
  const rows = PROPERTY_REGIONS.map(region => metric({ metricKey: `${region.code.toLowerCase()}_auction_clearance`, label: `${region.code} auction clearance`, context: 'Statewide preliminary auction results', groupKey: 'PROPERTY' }));
  rows.push(metric({metricKey:'auction_clearance',label:'Australia auction clearance',context:'Weighted average of all eight jurisdictions',groupKey:'PROPERTY'}));
  const tas = rankAskMetrics('Tasmania auction clearance',rows);
  expect(tas[0]?.metricKey).toBe('tas_auction_clearance');
  expect(tas.some(row=>row.metricKey==='nsw_auction_clearance')).toBe(false);
  expect(rankAskMetrics('Australian auction clearance rate',rows)[0]?.metricKey).toBe('auction_clearance');
});
