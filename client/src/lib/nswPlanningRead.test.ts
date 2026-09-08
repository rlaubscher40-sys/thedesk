import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NswPlanningRead } from "../components/planning/NswPlanningRead";
import type { NswPlanningRead as PlanningRead } from "../../../shared/nswPlanning";
const snapshot: NonNullable<PlanningRead["snapshot"]> = {
  councilName: "Council of the City of Sydney",
  geographyKind: "local-government-area",
  from: "2026-08-01",
  to: "2026-08-31",
  retrievedAt: "2026-09-08T07:30:00Z",
  fingerprint: "test",
  applications: 4,
  originalApplications: 2,
  modifications: 1,
  reviews: 1,
  recordsWithDeterminationDate: 1,
  statusCounts: { "Under Assessment": 3, Determined: 1 },
  dwellings: { reported: 5, reportedApplications: 1, missingApplications: 1 },
  sourceUpdatedRange: null,
  completePagination: true,
};
describe("planning evidence presentation", () => {
  it("labels geography, partial totals, status meaning, period and source", () => {
    const html = renderToStaticMarkup(
      createElement(NswPlanningRead, { data: { status: "available", snapshot, previous: [] } })
    );
    for (const expected of [
      "City of Sydney council area only",
      "August 2026",
      "reported subtotal",
      "1 omit that count",
      "not approvals, construction starts or completed homes",
      "CC BY 4.0",
      "Official NSW Online DA dataset",
    ])
      expect(html).toContain(expected);
    expect(html).not.toContain("5 completed homes");
  });
  it("shows missing data without a zero signal", () => {
    const html = renderToStaticMarkup(
      createElement(NswPlanningRead, {
        data: { status: "unavailable", snapshot: null, previous: [] },
      })
    );
    expect(html).toContain("Missing data does not mean no applications");
    expect(html).not.toContain("<dd");
  });
  it("keeps revisions distinct from monthly change", () => {
    const html = renderToStaticMarkup(
      createElement(NswPlanningRead, {
        data: {
          status: "available",
          snapshot,
          previous: [{ ...snapshot, retrievedAt: "2026-09-07T07:30:00Z", applications: 3 }],
        },
      })
    );
    expect(html).toContain("source revisions, not growth from one month to another");
    expect(html).toContain("3 application records");
  });
});
