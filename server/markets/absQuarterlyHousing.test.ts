import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Sheet } from "../localData/parsers";
import {
  parseHousingTransfers,
  parseHousingCompletions,
  quarterlyRelease,
} from "./absQuarterlyHousing";
import { TRANSFER_SOURCE, COMPLETION_SOURCE } from "../../shared/quarterlyHousing";
function housingFixture(kind: "transfers" | "completions"): Sheet[] {
  return JSON.parse(
    readFileSync(new URL(`./fixtures/abs-${kind}.json`, import.meta.url), "utf8"),
    (_, v) =>
      typeof v === "string" && /^\d{4}-\d{2}-\d{2}T00:00:00.000Z$/.test(v) ? new Date(v) : v
  );
}
const time = "2026-09-17T10:00:00.000Z";
const transferRelease = {
  period: "2026-Q2",
  sourceUrl: TRANSFER_SOURCE.replace("latest-release", "jun-quarter-2026"),
  resourceUrl: TRANSFER_SOURCE.replace("latest-release", "jun-quarter-2026/643202.xlsx"),
};
const completionRelease = {
  period: "2026-Q1",
  sourceUrl: COMPLETION_SOURCE.replace("latest-release", "mar-2026"),
  resourceUrl: COMPLETION_SOURCE.replace("latest-release", "mar-2026/87520039.xlsx"),
};
const table = (s: Sheet[]) => s.find((s) => s.sheet === "Data1")!.data;
describe("ABS quarterly housing contracts", () => {
  it("reproduces all published capital-city medians and sales, retaining separate segments", () => {
    const data = parseHousingTransfers(housingFixture("transfers"), transferRelease, time);
    expect(data.observations).toHaveLength(15 * 8);
    expect(
      data.observations
        .filter((r) => r.period === "2026-Q2" && !r.area.startsWith("Rest"))
        .map((r) => [
          r.area,
          r.houseMedian,
          r.attachedMedian,
          r.houseTransfers,
          r.attachedTransfers,
        ])
    ).toEqual([
      ["Sydney", 1487600, 840000, 8932, 9891],
      ["Melbourne", 850000, 590000, 11414, 12262],
      ["Brisbane", 1155000, 830100, 6559, 3509],
      ["Adelaide", 975000, 725000, 4270, 1735],
      ["Perth", 1010000, 730000, 5154, 2369],
      ["Hobart", 750000, 600000, 473, 223],
      ["Darwin", 752500, 445500, 360, 408],
      ["Canberra", 1030000, 615000, 1061, 1143],
    ]);
  });
  it("reads original state completions, not national seasonally adjusted counts", () => {
    const data = parseHousingCompletions(housingFixture("completions"), completionRelease, time);
    expect(data.observations).toHaveLength(8 * 8);
    expect(data.observations.filter((r) => r.period === "2026-Q1").map((r) => r.year)).toEqual([
      44804, 54599, 33060, 14051, 19963, 2285, 601, 4160,
    ]);
    expect(
      data.observations.filter((r) => r.period === "2026-Q1").map((r) => [r.state, r.quarter])
    ).toEqual([
      ["NSW", 8883],
      ["VIC", 12220],
      ["QLD", 8035],
      ["SA", 3102],
      ["WA", 4441],
      ["TAS", 494],
      ["NT", 154],
      ["ACT", 1003],
    ]);
  });
  it.each(["Seasonally Adjusted", "Trend"])("rejects changed series basis: %s", (basis) => {
    const s = housingFixture("transfers");
    table(s)[2]![1] = basis;
    expect(() => parseHousingTransfers(s, transferRelease, time)).toThrow();
  });
  it.each(["unit", "heading", "frequency", "end", "duplicate", "gap", "negative", "fractional"])(
    "fails closed on %s",
    (fault) => {
      const s = housingFixture("transfers"),
        r = table(s);
      if (fault === "unit") r[1]![1] = "Dollars";
      if (fault === "heading") r[0]![1] = "Mean value of dwellings";
      if (fault === "frequency") r[4]![1] = "Month";
      if (fault === "end") r[7]![1] = new Date("2026-03-01");
      if (fault === "duplicate") r[9]![2] = r[9]![1];
      if (fault === "gap") r.splice(15, 1);
      if (fault === "negative") r.at(-1)![1] = -1;
      if (fault === "fractional") r.at(-1)![31] = 0.5;
      expect(() => parseHousingTransfers(s, transferRelease, time)).toThrow();
    }
  );
  it("preserves suppressed cells, zero counts and incomplete annual windows", () => {
    const s = housingFixture("completions"),
      r = table(s);
    r.at(-2)![28] = "np";
    r.at(-1)![28] = 0;
    expect(parseHousingCompletions(s, completionRelease, time).observations[0]).toMatchObject({
      quarter: 0,
      year: null,
    });
  });
  it("binds release title, quarter and exact dated download", () => {
    const html = `<h1>Total Value of Dwellings</h1><div class="field--name-field-abs-reference-period">Reference period June Quarter 2026</div><a href="${transferRelease.resourceUrl}">Table 2</a>`;
    expect(quarterlyRelease(html, "transfers", time)).toEqual(transferRelease);
    for (const bad of [
      html.replace("June Quarter", "September Quarter"),
      html.replace("643202", "643201"),
      html.replace("Total Value of Dwellings", "Building Activity, Australia"),
      html + "<h1>Duplicate</h1>",
    ])
      expect(() => quarterlyRelease(bad, "transfers", time)).toThrow();
  });
});
