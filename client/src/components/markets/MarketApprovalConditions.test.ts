import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { parseAbsApprovals } from "../../../../server/markets/absApprovals";
import { MarketApprovalConditions } from "./MarketApprovalConditions";
const { useQuery } = vi.hoisted(() => ({ useQuery: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: { markets: { housingApprovals: { useQuery } } } }));
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-17T09:00:00Z"));
  useQuery.mockReturnValue({ isPending: false, data: parseAbsApprovals(
    readFileSync(new URL("../../../../server/markets/fixtures/abs-approvals.csv", import.meta.url), "utf8"), "2026-09-17T09:00:00Z"
  ) });
});
afterEach(() => vi.useRealTimers());
const render = (period: string, market = "Brisbane") => renderToStaticMarkup(createElement(MarketApprovalConditions, { market, period }));
it("opens the exact annual approvals citation and anchor", () => {
  const html = render("2026-07");
  expect(html).toContain('id="housing-approvals"');
  expect(html).toContain("27,628");
  expect(html).toContain("July 2026");
});
it("does not replace missing or invalid periods", () => {
  for (const period of ["2025-01", "2026-08", "", "2026-13"]) {
    expect(render(period)).not.toContain("27,628");
    expect(render(period)).toContain("different period is not substituted");
  }
});
it("shows loading and failed evidence honestly", () => {
  useQuery.mockReturnValue({ isPending: true });
  expect(render("2026-07")).toContain("Loading the requested approvals evidence");
  useQuery.mockReturnValue({ isPending: false, isError: true });
  expect(render("2026-07")).toContain("unavailable right now");
});
it("does not replace regional localities with capitals", () => {
  expect(render("2026-07", "Townsville")).toBe("");
  expect(useQuery).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ enabled: false }));
});
