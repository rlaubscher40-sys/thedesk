import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  annualStateDemographics,
  DEMOGRAPHIC_FLOW,
  demographicsDataUrl,
} from "../../shared/stateDemographics";
import { getStateDemographics, parseAbsDemographics } from "./absDemographics";
import { invalidate } from "../core/cache";

const retrievedAt = "2026-09-08T00:00:00.000Z";
const csv = readFileSync(new URL("./fixtures/abs-demographics.csv", import.meta.url), "utf8");

describe("verified ABS state demographics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    invalidate("abs:demographics:attempt");
    invalidate("abs:demographics:data");
  });

  it("pins the flow, dimensions and bounded time range", () => {
    const url = demographicsDataUrl(retrievedAt);
    expect(url).toContain("/ABS,ERP_COMP_Q,1.0.0/6+9+10.1+2+3+4+5+6+7+8.Q?");
    expect(url).toContain("startPeriod=2024-Q4");
    expect(url).toContain("format=csv");
  });

  it("parses verified states, measures, multipliers and reference quarters", () => {
    const data = parseAbsDemographics(csv, retrievedAt);
    expect(data.status).toBe("available");
    expect(data.observations).toHaveLength(30);
    expect(data.observations).toContainEqual({
      state: "Queensland",
      measure: "population",
      period: "2025-Q4",
      people: 5_712_100,
      status: "",
    });
    expect(data.observations).toContainEqual({
      state: "Western Australia",
      measure: "netInternalMigration",
      period: "2025-Q4",
      people: 2_415,
      status: "",
    });
  });

  it.each([
    [DEMOGRAPHIC_FLOW, "ABS:ERP_Q(1.0.0)"],
    [",6,3,Q,", ",6,9,Q,"],
    [",6,3,Q,", ",8,3,Q,"],
    [",6,3,Q,", ",6,3,M,"],
    [",NUM,0,,", ",PCT,0,,"],
    [",10,3,Q,2024-Q4,5620,NUM,3", ",10,3,Q,2024-Q4,5620,NUM,0"],
  ])("rejects changed identity %s", (before, after) => {
    expect(() => parseAbsDemographics(csv.replace(before, after), retrievedAt)).toThrow("series");
  });

  it("retains suppressed observations as gaps instead of zero or an older substitute", () => {
    const changed = csv.replace(
      ",10,3,Q,2025-Q4,5712.1,NUM,3,,",
      ",10,3,Q,2025-Q4,5712.1,NUM,3,s,"
    );
    const data = parseAbsDemographics(changed, retrievedAt);
    expect(
      data.observations.find(
        (row) =>
          row.state === "Queensland" && row.measure === "population" && row.period === "2025-Q4"
      )?.people
    ).toBeNull();
    expect(annualStateDemographics(data, "Queensland", "2026-09-08")).toBeNull();
  });

  it("does not round a fractional person into a valid migration observation", () => {
    const changed = csv.replace(",6,3,Q,2025-Q4,4913,NUM,0,,", ",6,3,Q,2025-Q4,4913.5,NUM,0,,");
    const data = parseAbsDemographics(changed, retrievedAt);
    expect(
      data.observations.find(
        (row) =>
          row.state === "Queensland" &&
          row.measure === "netInternalMigration" &&
          row.period === "2025-Q4"
      )?.people
    ).toBeNull();
  });

  it("converts decimal thousands exactly without losing valid whole-person counts", () => {
    for (const [value, expected] of [
      ["65.531", 65531],
      ["-65.531", -65531],
      ["65.5310", 65531],
      ["65.5311", null],
      ["65.531000000000001", null],
    ] as const) {
      const changed = csv.replace(",9,3,Q,2025-Q2,11.3,NUM,3,,", `,9,3,Q,2025-Q2,${value},NUM,3,,`);
      const data = parseAbsDemographics(changed, retrievedAt);
      expect(
        data.observations.find(
          (row) =>
            row.state === "Queensland" &&
            row.measure === "netOverseasMigration" &&
            row.period === "2025-Q2"
        )?.people
      ).toBe(expected);
      expect(annualStateDemographics(data, "Queensland", "2026-09-08") !== null).toBe(
        expected !== null
      );
    }
  });

  it("rejects duplicate rows, malformed quarters and changed schema", () => {
    const row = csv.split("\n")[1]!;
    expect(() => parseAbsDemographics(`${csv}${row}\n`, retrievedAt)).toThrow("Duplicate");
    expect(() => parseAbsDemographics(csv.replace("2025-Q4", "2025-Q5"), retrievedAt)).toThrow(
      "period"
    );
    expect(() => parseAbsDemographics(csv.replace("OBS_VALUE", "VALUE"), retrievedAt)).toThrow(
      "schema"
    );
  });

  it("computes only four consecutive quarters against the same prior-year population", () => {
    const data = parseAbsDemographics(csv, retrievedAt);
    expect(annualStateDemographics(data, "Queensland", "2026-09-08")).toMatchObject({
      state: "Queensland",
      period: "2025-Q4",
      population: 5_712_100,
      annualChange: 92_100,
      netInternalMigration: 16_528,
      netOverseasMigration: 54_600,
      preliminary: false,
      revised: false,
    });
    expect(annualStateDemographics(data, "Queensland", "2026-09-08")!.annualPercent).toBeCloseTo(
      1.6388,
      3
    );
    expect(annualStateDemographics(data, "Western Australia", "2026-09-08")).toMatchObject({
      population: 3_076_500,
      annualChange: 65_400,
      netInternalMigration: 10_419,
      netOverseasMigration: 40_400,
    });
  });

  it("withholds missing quarters, stale data, future data and unsupported states", () => {
    const data = parseAbsDemographics(csv, retrievedAt);
    data.observations = data.observations.filter(
      (row) =>
        !(
          row.state === "Queensland" &&
          row.measure === "netInternalMigration" &&
          row.period === "2025-Q2"
        )
    );
    expect(annualStateDemographics(data, "Queensland", "2026-09-08")).toBeNull();
    const intact = parseAbsDemographics(csv, retrievedAt);
    expect(annualStateDemographics(intact, "Queensland", "2027-01-08")).toBeNull();
    expect(annualStateDemographics(intact, "Queensland", "2025-12-01")).toBeNull();
    expect(annualStateDemographics(intact, "New South Wales", "2026-09-08")).toBeNull();
  });

  it("surfaces preliminary and revised flags from any contributing quarter", () => {
    const changed = csv
      .replace(",10,3,Q,2025-Q4,5712.1,NUM,3,,", ",10,3,Q,2025-Q4,5712.1,NUM,3,p,")
      .replace(",9,3,Q,2025-Q2,11.3,NUM,3,,", ",9,3,Q,2025-Q2,11.3,NUM,3,r,");
    expect(
      annualStateDemographics(
        parseAbsDemographics(changed, retrievedAt),
        "Queensland",
        "2026-09-08"
      )
    ).toMatchObject({ preliminary: true, revised: true });
  });

  it("returns unavailable on transport, type and parse failures", async () => {
    for (const response of [
      new Response("no", { status: 503 }),
      new Response(csv, { headers: { "content-type": "text/html" } }),
      new Response("bad", { headers: { "content-type": "text/csv" } }),
      new Response("x".repeat(64_001), { headers: { "content-type": "text/csv" } }),
    ]) {
      invalidate("abs:demographics:attempt");
      invalidate("abs:demographics:data");
      vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response));
      expect((await getStateDemographics()).status).toBe("unavailable");
    }
  });
});
