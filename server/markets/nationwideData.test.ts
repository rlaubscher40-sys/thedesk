import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { parseAbsApprovals } from "./absApprovals";
import { parseAbsDemographics } from "./absDemographics";
import { APPROVAL_REGIONS, annualApprovals, approvalsDataUrl } from "../../shared/cityApprovals";
import {
  DEMOGRAPHIC_REGIONS,
  annualStateDemographics,
  demographicsDataUrl,
} from "../../shared/stateDemographics";
import { stateDemographicMetrics } from "../../shared/stateDemographicMetrics";
import { StateDemographicsRead } from "../../shared/StateDemographicsRead";
import { CityApprovalRead } from "../../shared/CityApprovalRead";

const asOf = "2026-09-08";
/** Synthetic copies test geographic wiring and bounds only; these are NOT observed state values. */
function allRegionsFixture(file: string, dimension: string, original: string, codes: string[]) {
  const [header, ...rows] = readFileSync(new URL(`./fixtures/${file}`, import.meta.url), "utf8")
    .trim()
    .split(/\r?\n/);
  const column = header!.split(",").indexOf(dimension);
  const originals = rows.map((row) => row.split(",")).filter((row) => row[column] === original);
  return [
    header,
    ...codes.flatMap((code) =>
      originals.map((row) => row.map((cell, index) => (index === column ? code : cell)).join(","))
    ),
  ].join("\n");
}

it("requests and parses all eight capital/territory approval geographies without exceeding the old two-city bound", () => {
  const codes = Object.keys(APPROVAL_REGIONS);
  expect(codes).toHaveLength(8);
  expect(approvalsDataUrl(asOf)).toContain(codes.join("+"));
  const data = parseAbsApprovals(
    allRegionsFixture("abs-approvals.csv", "REGION", "3GBRI", codes),
    asOf
  );
  for (const city of Object.values(APPROVAL_REGIONS))
    expect(annualApprovals(data, city, asOf)?.city).toBe(city);
  expect(annualApprovals(data, "Townsville", asOf)).toBeNull();
  const html = renderToStaticMarkup(
    createElement(CityApprovalRead, { data, cities: ["Canberra"], asOf })
  );
  expect(html).toContain("Australian Capital Territory");
  expect(html).not.toContain("Greater Canberra");
});

it("requests all eight state demographic series and preserves state boundaries in 32 persisted metrics", () => {
  const codes = Object.keys(DEMOGRAPHIC_REGIONS);
  expect(codes).toHaveLength(8);
  expect(demographicsDataUrl(asOf)).toContain(codes.join("+"));
  const data = parseAbsDemographics(
    allRegionsFixture("abs-demographics.csv", "REGION", "3", codes),
    asOf
  );
  for (const state of Object.values(DEMOGRAPHIC_REGIONS))
    expect(annualStateDemographics(data, state, asOf)?.state).toBe(state);
  const metrics = stateDemographicMetrics(data, asOf);
  expect(metrics).toHaveLength(32);
  expect(metrics.every((metric) => metric.asOf === "2025-12-31T00:00:00.000Z")).toBe(true);
  expect(
    metrics.every(
      (metric) => metric.context.length <= 256 && metric.sourceUrl.includes("abs.gov.au")
    )
  ).toBe(true);
  const html = renderToStaticMarkup(
    createElement(StateDemographicsRead, { data, stateCode: "NSW", asOf })
  );
  expect(html).toContain("New South Wales");
  expect(html).toContain("whole state or territory");
  expect(html).not.toContain("Sydney population");
});

it("does not publish incomplete or stale state series", () => {
  const data = parseAbsDemographics(
    allRegionsFixture("abs-demographics.csv", "REGION", "3", ["6"]),
    asOf
  );
  data.observations = data.observations.filter(
    (row) => !(row.measure === "netInternalMigration" && row.period === "2025-Q2")
  );
  expect(stateDemographicMetrics(data, asOf)).toEqual([]);
  expect(stateDemographicMetrics(data, "2027-01-01")).toEqual([]);
});
