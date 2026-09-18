import { beforeEach, describe, expect, it, vi } from "vitest";
import { invalidate } from "../core/cache";
import type { NswPlanningRecord } from "../../shared/nswPlanning";

const mocks = vi.hoisted(() => ({
  vintages: vi.fn(),
  save: vi.fn(),
  fetch: vi.fn(),
  demo: vi.fn(),
}));
vi.mock("../db/planningSnapshots", () => ({
  readPlanningVintages: mocks.vintages,
  savePlanningSnapshot: mocks.save,
}));
vi.mock("./nswDa", () => ({ fetchNswPlanningSnapshot: mocks.fetch }));
vi.mock("../demo/store", () => ({ isDemoMode: mocks.demo }));

import { getProjectFollowThrough, refreshProjectFollowThrough } from "./followThrough";

const NOW = new Date("2026-09-18T04:00:00.000Z");
// followThroughPeriods(NOW) is ["2026-07", "2026-06", "2026-05"].

const base: NswPlanningRecord = {
  applicationId: "PAN-700001",
  applicationType: "Development Application",
  status: "Under Assessment",
  councilName: "Council of the City of Sydney",
  lodgedOn: "2026-07-03",
  determinedOn: null,
  sourceUpdatedAt: "2026-07-05T01:00:00.000",
  proposedDwellings: 20,
};

function vintage(retrievedAt: string, records: Partial<NswPlanningRecord>[]) {
  return {
    retrievedAt,
    fingerprint: "a".repeat(64),
    records: records.map((record) => ({ ...base, ...record })),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  invalidate("nsw:");
  mocks.demo.mockReturnValue(false);
  mocks.vintages.mockResolvedValue([]);
});

describe("follow-through read", () => {
  it("follows the most recent tracked month that has retained reads", async () => {
    mocks.vintages.mockImplementation(async (_council: string, from: string) =>
      from === "2026-07-01"
        ? [
            vintage("2026-07-10T00:00:00.000Z", [{}]),
            vintage("2026-09-15T00:00:00.000Z", [
              {
                status: "Determined",
                determinedOn: "2026-09-12",
                sourceUpdatedAt: "2026-09-13T00:00:00.000",
              },
            ]),
          ]
        : []
    );
    const read = await getProjectFollowThrough(NOW);
    expect(read.status).toBe("available");
    expect(read.period).toBe("2026-07");
    expect(read.cohort.map((project) => project.applicationId)).toEqual(["PAN-700001"]);
    expect(read.checks).toBe(2);
    expect(read.lastCheckedAt).toBe("2026-09-15T00:00:00.000Z");
    expect(read.updates).toHaveLength(2);
    // Fixed council and whole-month windows only; no caller-supplied filter.
    expect(mocks.vintages).toHaveBeenCalledWith(
      "Council of the City of Sydney",
      "2026-07-01",
      "2026-07-31",
      24
    );
  });

  it("falls back to an older tracked month when the newest has nothing retained", async () => {
    mocks.vintages.mockImplementation(async (_council: string, from: string) =>
      from === "2026-06-01"
        ? [vintage("2026-07-01T00:00:00.000Z", [{ lodgedOn: "2026-06-02" }])]
        : []
    );
    const read = await getProjectFollowThrough(NOW);
    expect(read.period).toBe("2026-06");
    expect(read.status).toBe("available");
  });

  it("is unavailable rather than empty when nothing has been retained", async () => {
    const read = await getProjectFollowThrough(NOW);
    expect(read).toMatchObject({ status: "unavailable", period: null, cohort: [], checks: 0 });
    expect(mocks.vintages).toHaveBeenCalledTimes(3);
  });

  it("is unavailable on a storage failure and never serves a partial cohort", async () => {
    mocks.vintages.mockRejectedValue(new Error("DB unavailable"));
    expect((await getProjectFollowThrough(NOW)).status).toBe("unavailable");
  });

  it("reads nothing at all in demo mode", async () => {
    mocks.demo.mockReturnValue(true);
    expect((await getProjectFollowThrough(NOW)).status).toBe("unavailable");
    expect(mocks.vintages).not.toHaveBeenCalled();
  });

  it("excludes modifications and reviews from the cohort", async () => {
    mocks.vintages.mockImplementation(async (_council: string, from: string) =>
      from === "2026-07-01"
        ? [
            vintage("2026-07-10T00:00:00.000Z", [
              { applicationId: "PAN-700002", applicationType: "Modification Application" },
              { applicationId: "PAN-700003", applicationType: "Review of determination" },
              { applicationId: "PAN-700001" },
            ]),
          ]
        : []
    );
    const read = await getProjectFollowThrough(NOW);
    expect(read.cohort.map((project) => project.applicationId)).toEqual(["PAN-700001"]);
  });

  it("caches so a page view cannot drive one storage read per visitor", async () => {
    mocks.vintages.mockImplementation(async (_council: string, from: string) =>
      from === "2026-07-01" ? [vintage("2026-07-10T00:00:00.000Z", [{}])] : []
    );
    await getProjectFollowThrough(NOW);
    const calls = mocks.vintages.mock.calls.length;
    await getProjectFollowThrough(NOW);
    expect(mocks.vintages.mock.calls.length).toBe(calls);
  });
});

describe("cohort refresh", () => {
  it("re-reads each tracked month against the fixed council and saves complete reads only", async () => {
    mocks.fetch.mockResolvedValue({ snapshot: { completePagination: true }, records: [] });
    const results = await refreshProjectFollowThrough(NOW);
    expect(results).toEqual([
      { period: "2026-07", state: "saved" },
      { period: "2026-06", state: "saved" },
      { period: "2026-05", state: "saved" },
    ]);
    expect(mocks.fetch).toHaveBeenCalledWith({
      councilName: "Council of the City of Sydney",
      from: "2026-07-01",
      to: "2026-07-31",
    });
    expect(mocks.save).toHaveBeenCalledTimes(3);
  });

  it("reports a failed period and keeps going, without saving anything for it", async () => {
    mocks.fetch.mockImplementation(async ({ from }: { from: string }) => {
      if (from === "2026-06-01") throw new Error("source unavailable");
      return { snapshot: { completePagination: true }, records: [] };
    });
    const results = await refreshProjectFollowThrough(NOW);
    expect(results.map((result) => result.state)).toEqual(["saved", "failed", "saved"]);
    expect(mocks.save).toHaveBeenCalledTimes(2);
  });

  it("does nothing in demo mode", async () => {
    mocks.demo.mockReturnValue(true);
    expect(await refreshProjectFollowThrough(NOW)).toEqual([]);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
