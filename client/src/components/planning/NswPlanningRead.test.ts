import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, expect, it, vi } from "vitest";
import { NswPlanningPanel, NswPlanningRead } from "./NswPlanningRead";
import type { NswPlanningSnapshot } from "@shared/nswPlanning";
const mocks = vi.hoisted(() => ({search:vi.fn(),query:vi.fn()}));
vi.mock("wouter", () => ({useSearch: mocks.search}));
vi.mock("@/lib/trpc", () => ({trpc:{metrics:{planningPilot:{useQuery:mocks.query}}}}));
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());
const snapshot: NswPlanningSnapshot = {
  councilName:"Council of the City of Sydney",geographyKind:"local-government-area",
  from:"2026-08-01",to:"2026-08-31",retrievedAt:"2026-09-01T00:00:00Z",fingerprint:"a".repeat(64),
  applications:96,originalApplications:92,modifications:4,reviews:0,recordsWithDeterminationDate:0,statusCounts:{},
  dwellings:{reported:268,reportedApplications:33,missingApplications:59},sourceUpdatedRange:null,completePagination:true,
};
it("links each displayed planning snapshot to its month and revision", () => {
  const html = renderToStaticMarkup(React.createElement(NswPlanningRead,{data:{status:"available",snapshot,previous:[]},pinned:true}));
  expect(html).toContain(`planningPeriod=2026-08&amp;planningRevision=${snapshot.fingerprint}#nsw-planning`);
  expect(html).toContain("not a live count");
  expect(html).toContain("proposals, not approvals");
});
it("requests pinned stored evidence from the URL", () => {
  mocks.search.mockReturnValue(`planningPeriod=2026-08&planningRevision=${snapshot.fingerprint}`);
  mocks.query.mockReturnValue({data:{status:"available",snapshot,previous:[]}});
  renderToStaticMarkup(React.createElement(NswPlanningPanel));
  expect(mocks.query).toHaveBeenLastCalledWith({period:"2026-08",fingerprint:snapshot.fingerprint},expect.objectContaining({enabled:true}));
});
it("shows missing evidence without pretending there were zero applications", () => {
  const html = renderToStaticMarkup(React.createElement(NswPlanningRead,{data:{status:"unavailable",snapshot:null,previous:[]},pinned:true}));
  expect(html).toContain("different period or revision has not been substituted");
  expect(html).toContain("Missing data does not mean no applications");
});
it.each(["planningPeriod=2026-13", "planningRevision=bad", "planningPeriod="])("invalid pins do not run the latest-period query: %s", search => {
  mocks.search.mockReturnValue(search);
  mocks.query.mockReturnValue({isLoading:true,data:{status:"available",snapshot,previous:[]}});
  const html = renderToStaticMarkup(React.createElement(NswPlanningPanel));
  expect(mocks.query).toHaveBeenLastCalledWith(undefined,expect.objectContaining({enabled:false}));
  expect(html).toContain("Invalid planning evidence link");
  expect(html).not.toContain("268");
});
