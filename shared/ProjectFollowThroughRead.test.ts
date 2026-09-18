import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { ProjectFollowThroughRead } from "./ProjectFollowThroughRead";
import type { NswPlanningRecord } from "./nswPlanning";
import { buildProjectFollowThrough, type PlanningVintage } from "./projectFollowThrough";

vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());

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

function vintage(retrievedAt: string, record: Partial<NswPlanningRecord>): PlanningVintage {
  return { retrievedAt, fingerprint: "a".repeat(64), records: [{ ...base, ...record }] };
}

const determined = buildProjectFollowThrough("pan-643200", [
  vintage("2026-08-26T02:00:00.000Z", {}),
  vintage("2026-09-10T02:00:00.000Z", {
    status: "Determined",
    determinedOn: "2026-09-08",
    sourceUpdatedAt: "2026-09-09T00:00:00.000",
    proposedDwellings: 11,
  }),
])!;

const unchanged = buildProjectFollowThrough("pan-643200", [
  vintage("2026-08-26T02:00:00.000Z", {}),
  vintage("2026-09-01T02:00:00.000Z", {}),
])!;

function render(project = determined, overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    React.createElement(ProjectFollowThroughRead, {
      data: {
        status: "available",
        councilName: base.councilName,
        period: "2026-08",
        cohort: [project],
        checks: 2,
        lastCheckedAt: "2026-09-10T02:00:00.000Z",
        ...overrides,
      },
    })
  );
}

describe("project follow-through page", () => {
  it("reports a determination without ever calling it an approval", () => {
    const html = render();
    expect(html).toContain("Determination recorded");
    expect(html).toContain("Confirmed by the source");
    // No milestone heading may claim an outcome the source does not publish.
    const headings = [...html.matchAll(/<p class="font-semibold">(.*?)<\/p>/g)].map((m) => m[1]!);
    expect(headings.length).toBeGreaterThan(0);
    expect(headings.some((heading) => /approv|refus|reject/i.test(heading))).toBe(false);
    // The only mentions of approval are the explicit disclaimers.
    expect(html).toContain("this page never says approved");
    expect(html).toContain("does not publish whether the determination approved or refused");
  });

  it("marks construction and completion as not evidenced", () => {
    const html = render();
    expect(html).toContain("Construction started");
    expect(html).toContain("Homes completed");
    expect(html).toContain("No evidence found");
  });

  it("says no newer evidence was found instead of implying progress", () => {
    const html = render(unchanged);
    expect(html).toContain("No newer evidence found since 2026-08-26");
    expect(html).toContain("not a report that nothing has happened");
  });

  it("shows a revised dwelling count as a revision, never a sum", () => {
    const html = render();
    expect(html).toContain("Each figure replaces the one before it");
    expect(html).toContain("never added together");
    expect(html).not.toContain(">14<");
  });

  it("carries the source, its licence and the PlanningAlerts position", () => {
    const html = render();
    expect(html).toContain("CC BY 4.0");
    expect(html).toContain("planningportal.nsw.gov.au");
    expect(html).toContain("restricted to non-commercial use");
  });

  it("renders the method and limits with no data at all, for a crawler", () => {
    const html = renderToStaticMarkup(React.createElement(ProjectFollowThroughRead, {}));
    expect(html).toContain("What happened after the application?");
    expect(html).toContain("A determination is not an approval");
    expect(html).toContain("Dwelling counts are revised, not added");
    expect(html).not.toContain("PAN-");
  });

  it("says nothing is available rather than showing an empty timeline", () => {
    const html = renderToStaticMarkup(
      React.createElement(ProjectFollowThroughRead, {
        data: {
          status: "unavailable",
          councilName: base.councilName,
          period: null,
          cohort: [],
          checks: 0,
          lastCheckedAt: null,
        },
      })
    );
    expect(html).toContain("No cohort is available to follow yet");
    expect(html).toContain("does not estimate a timeline");
  });
});
