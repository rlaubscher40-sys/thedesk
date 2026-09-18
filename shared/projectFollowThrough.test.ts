import { describe, expect, it } from "vitest";
import type { NswPlanningRecord } from "./nswPlanning";
import {
  buildProjectFollowThrough,
  followThroughFreshness,
  followThroughPeriods,
  followThroughUpdates,
  projectApplicationId,
  projectIdentity,
  selectFollowThroughCohort,
  type PlanningVintage,
} from "./projectFollowThrough";

const base: NswPlanningRecord = {
  applicationId: "PAN-643200",
  applicationType: "Development Application",
  status: "Under Assessment",
  councilName: "Council of the City of Sydney",
  lodgedOn: "2026-08-14",
  determinedOn: null,
  sourceUpdatedAt: "2026-08-25T22:44:34.400",
  proposedDwellings: 3,
};

function vintage(
  retrievedAt: string,
  records: Partial<NswPlanningRecord>[],
  fingerprint = "a".repeat(64)
): PlanningVintage {
  return {
    retrievedAt,
    fingerprint,
    records: records.map((record) => ({ ...base, ...record })),
  };
}

describe("project identity", () => {
  it("round-trips a planning portal application number and refuses anything else", () => {
    expect(projectIdentity("PAN-643200")).toBe("pan-643200");
    expect(projectIdentity("  PAN-643200 ")).toBe("pan-643200");
    expect(projectApplicationId("pan-643200")).toBe("PAN-643200");
    for (const bad of ["643200", "PAN-", "PAN-abc", "pan-643200", "PAN-643200; DROP", ""])
      expect(projectIdentity(bad)).toBeNull();
    for (const bad of ["PAN-643200", "pan-", "pan-x", ""])
      expect(projectApplicationId(bad)).toBeNull();
  });
});

describe("cohort selection", () => {
  const records: NswPlanningRecord[] = [
    { ...base, applicationId: "PAN-100", proposedDwellings: 12 },
    { ...base, applicationId: "PAN-101", proposedDwellings: null },
    { ...base, applicationId: "PAN-102", proposedDwellings: 40 },
    {
      ...base,
      applicationId: "PAN-103",
      applicationType: "Modification Application",
      proposedDwellings: 99,
    },
    {
      ...base,
      applicationId: "PAN-104",
      applicationType: "Review of determination",
      proposedDwellings: 98,
    },
    { ...base, applicationId: "PAN-102", proposedDwellings: 40 },
  ];

  it("takes original applications only, deterministically, without duplicates", () => {
    expect(selectFollowThroughCohort(records, 3)).toEqual(["pan-102", "pan-100", "pan-101"]);
    // Running it again on the same evidence must not reshuffle the cohort.
    expect(selectFollowThroughCohort(records, 3)).toEqual(selectFollowThroughCohort(records, 3));
  });

  it("never follows a modification or a review as a project of its own", () => {
    const cohort = selectFollowThroughCohort(records, 10);
    expect(cohort).not.toContain("pan-103");
    expect(cohort).not.toContain("pan-104");
    expect(cohort).toHaveLength(3);
  });

  it("refuses a nonsense limit", () => {
    for (const limit of [0, -1, 2.5, NaN])
      expect(selectFollowThroughCohort(records, limit)).toEqual([]);
  });
});

describe("timeline from retained vintages", () => {
  it("folds repeat checks and reports no newer evidence rather than progress", () => {
    const project = buildProjectFollowThrough("pan-643200", [
      vintage("2026-08-26T02:00:00.000Z", [{}]),
      vintage("2026-08-27T02:00:00.000Z", [{}]),
      vintage("2026-08-28T02:00:00.000Z", [{}]),
    ])!;
    expect(project.observations).toHaveLength(1);
    expect(project.repeatChecks).toBe(2);
    expect(project.changes).toEqual([]);
    expect(project.lastCheckedAt).toBe("2026-08-28T02:00:00.000Z");
    expect(project.noNewerEvidenceSince).toBe("2026-08-26T02:00:00.000Z");
    expect(followThroughFreshness(project)).toContain("No newer evidence found since 2026-08-26");
    expect(followThroughFreshness(project)).toContain("not a report that nothing has happened");
  });

  it("records a status move and a determination as separate dated changes", () => {
    const project = buildProjectFollowThrough("pan-643200", [
      vintage("2026-08-26T02:00:00.000Z", [{}]),
      vintage("2026-09-10T02:00:00.000Z", [
        {
          status: "Determined",
          determinedOn: "2026-09-08",
          sourceUpdatedAt: "2026-09-09T01:02:03.000",
        },
      ]),
    ])!;
    expect(project.changes).toEqual([
      {
        kind: "status",
        from: "Under Assessment",
        to: "Determined",
        sourceUpdatedAt: "2026-09-09T01:02:03.000",
        observedAt: "2026-09-10T02:00:00.000Z",
      },
      {
        kind: "determination",
        on: "2026-09-08",
        sourceUpdatedAt: "2026-09-09T01:02:03.000",
        observedAt: "2026-09-10T02:00:00.000Z",
      },
    ]);
    expect(project.noNewerEvidenceSince).toBeNull();
    const determination = project.milestones.find((m) => m.stage === "determination")!;
    expect(determination.basis).toBe("confirmed-event");
    expect(determination.on).toBe("2026-09-08");
    // The source publishes a determination, not its outcome.
    expect(determination.label).not.toMatch(/approv/i);
    expect(determination.detail).toContain("does not publish whether the determination approved");
  });

  it("keeps a revised dwelling count as a revision and never adds the figures", () => {
    const project = buildProjectFollowThrough("pan-643200", [
      vintage("2026-08-26T02:00:00.000Z", [{ proposedDwellings: 3 }]),
      vintage("2026-09-02T02:00:00.000Z", [
        { proposedDwellings: 11, sourceUpdatedAt: "2026-09-01T00:00:00.000" },
      ]),
    ])!;
    expect(project.dwellingHistory).toEqual([
      { value: 3, sourceUpdatedAt: "2026-08-25T22:44:34.400" },
      { value: 11, sourceUpdatedAt: "2026-09-01T00:00:00.000" },
    ]);
    expect(project.reportedDwellings).toBe(11);
    const total = project.dwellingHistory.reduce((sum, entry) => sum + (entry.value ?? 0), 0);
    expect(project.reportedDwellings).not.toBe(total);
  });

  it("distinguishes a missing count from a zero count", () => {
    const project = buildProjectFollowThrough("pan-643200", [
      vintage("2026-08-26T02:00:00.000Z", [{ proposedDwellings: null }]),
      vintage("2026-09-02T02:00:00.000Z", [
        { proposedDwellings: 0, sourceUpdatedAt: "2026-09-01T00:00:00.000" },
      ]),
    ])!;
    expect(project.dwellingHistory.map((entry) => entry.value)).toEqual([null, 0]);
    expect(project.changes[0]).toMatchObject({ kind: "dwellings", from: null, to: 0 });
    expect(project.reportedDwellings).toBe(0);
  });

  it("orders by when the source was read, not by the order the rows arrived", () => {
    const project = buildProjectFollowThrough("pan-643200", [
      vintage("2026-09-10T02:00:00.000Z", [
        {
          status: "Determined",
          determinedOn: "2026-09-08",
          sourceUpdatedAt: "2026-09-09T00:00:00.000",
        },
      ]),
      vintage("2026-08-26T02:00:00.000Z", [{}]),
    ])!;
    expect(project.observations.map((o) => o.status)).toEqual(["Under Assessment", "Determined"]);
  });

  it("marks construction, completion and any pre-lodgement announcement as not evidenced", () => {
    const project = buildProjectFollowThrough("pan-643200", [
      vintage("2026-08-26T02:00:00.000Z", [{}]),
    ])!;
    const byStage = Object.fromEntries(project.milestones.map((m) => [m.stage, m]));
    expect(byStage.construction!.basis).toBe("not-evidenced");
    expect(byStage.completion!.basis).toBe("not-evidenced");
    expect(byStage.proposal!.basis).toBe("not-evidenced");
    expect(byStage.application!.basis).toBe("confirmed-event");
    expect(byStage.application!.on).toBe("2026-08-14");
    expect(byStage.assessment!.basis).toBe("source-state");
    expect(project.milestones.map((m) => m.stage)).toEqual([
      "proposal",
      "application",
      "assessment",
      "determination",
      "construction",
      "completion",
    ]);
  });

  it("reports a withdrawal as a state, not as a determination", () => {
    const project = buildProjectFollowThrough("pan-643200", [
      vintage("2026-09-10T02:00:00.000Z", [{ status: "Withdrawn" }]),
    ])!;
    const determination = project.milestones.find((m) => m.stage === "determination")!;
    expect(determination.basis).toBe("source-state");
    expect(determination.label).toBe("Recorded as withdrawn");
    expect(determination.on).toBe("2026-08-25T22:44:34.400");
  });

  it("returns nothing for an application no read has ever returned", () => {
    expect(
      buildProjectFollowThrough("pan-999999", [vintage("2026-08-26T02:00:00.000Z", [{}])])
    ).toBeNull();
    expect(
      buildProjectFollowThrough("PAN-643200", [vintage("2026-08-26T02:00:00.000Z", [{}])])
    ).toBeNull();
    expect(buildProjectFollowThrough("pan-643200", [])).toBeNull();
    expect(buildProjectFollowThrough("pan-643200", [vintage("not-a-date", [{}])])).toBeNull();
  });

  it("carries the source licence and attribution on every project", () => {
    const project = buildProjectFollowThrough("pan-643200", [
      vintage("2026-08-26T02:00:00.000Z", [{}]),
    ])!;
    expect(project.source.licence).toBe("CC BY 4.0");
    expect(project.source.attribution).toContain("NSW");
    expect(project.source.dataset).toContain("planningportal.nsw.gov.au");
  });
});

describe("editorial updates", () => {
  const projects = [
    buildProjectFollowThrough("pan-643200", [
      vintage("2026-08-26T02:00:00.000Z", [{}]),
      vintage("2026-09-10T02:00:00.000Z", [
        {
          status: "Determined",
          determinedOn: "2026-09-08",
          sourceUpdatedAt: "2026-09-09T00:00:00.000",
        },
      ]),
    ])!,
    buildProjectFollowThrough("pan-662735", [
      vintage("2026-08-26T02:00:00.000Z", [{ applicationId: "PAN-662735" }]),
      vintage("2026-08-27T02:00:00.000Z", [{ applicationId: "PAN-662735" }]),
    ])!,
  ];

  it("returns only material changes, newest first", () => {
    const updates = followThroughUpdates(projects);
    expect(updates).toHaveLength(2);
    expect(updates.every((u) => u.projectId === "pan-643200")).toBe(true);
    expect(updates[0]!.summary).toContain("PAN-643200");
  });

  it("produces nothing when a repeat check found the same evidence", () => {
    expect(followThroughUpdates([projects[1]!])).toEqual([]);
  });

  it("filters to changes observed after a watermark", () => {
    expect(followThroughUpdates(projects, "2026-09-11T00:00:00.000Z")).toEqual([]);
    expect(followThroughUpdates(projects, "2026-08-01T00:00:00.000Z")).toHaveLength(2);
    expect(followThroughUpdates(projects, "nonsense")).toHaveLength(2);
  });

  it("never claims a determination approved anything", () => {
    const summary = followThroughUpdates(projects)
      .map((u) => u.summary)
      .join(" ");
    expect(summary).toContain("does not publish the determination outcome");
    expect(summary).not.toMatch(/\bapproved\b/i);
  });
});

describe("tracked periods", () => {
  it("tracks the three complete months before the pilot month, in Sydney time", () => {
    // 1 September 2026 in Sydney is still 31 August in UTC; the pilot month is August.
    expect(followThroughPeriods(new Date("2026-09-01T00:00:00.000Z"))).toEqual([
      "2026-07",
      "2026-06",
      "2026-05",
    ]);
    expect(followThroughPeriods(new Date("2026-09-18T04:00:00.000Z"))).toEqual([
      "2026-07",
      "2026-06",
      "2026-05",
    ]);
  });

  it("crosses a year boundary", () => {
    expect(followThroughPeriods(new Date("2026-02-15T04:00:00.000Z"))).toEqual([
      "2025-12",
      "2025-11",
      "2025-10",
    ]);
  });

  it("never returns the month the pilot is already reading", () => {
    const now = new Date("2026-09-18T04:00:00.000Z");
    expect(followThroughPeriods(now)).not.toContain("2026-08");
    expect(followThroughPeriods(now, 1)).toEqual(["2026-07"]);
    for (const bad of [0, -3, 1.5]) expect(followThroughPeriods(now, bad)).toEqual([]);
    expect(followThroughPeriods(new Date("nope"))).toEqual([]);
  });
});
