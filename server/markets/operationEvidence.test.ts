import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("./absRents", () => ({ getCityRents: vi.fn() }));
vi.mock("./absApprovals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./absApprovals")>()), getCityApprovals: vi.fn(),
}));
vi.mock("../db/planningSnapshots", () => ({ readPlanningSnapshots: vi.fn(async () => []) }));
vi.mock("../db/localData", () => ({ readLocalDataset: vi.fn(async () => null), readLocalDataHealth: vi.fn() }));
import { getCityRents } from "./absRents";
import { getCityApprovals, parseAbsApprovals } from "./absApprovals";
import { retrieveLocalFacts } from "../ask/localFacts";
import { annualApprovals } from "../../shared/cityApprovals";
import { CityApprovalRead } from "../../shared/CityApprovalRead";
import { comparisonSourceDate, comparisonQuality, observationPeriodEnd } from "../../shared/comparisonQuality";
import { comparisonAnswer, comparisonEvidence, comparisonNow } from "./comparison.fixture";
import { groundComparison } from "./grounding";
const data = () => parseAbsApprovals(readFileSync(new URL("./fixtures/abs-approvals.csv", import.meta.url), "utf8"), "2026-09-17T09:00:00Z");
const rents = {
  status: "available" as const, retrievedAt: "2026-09-17T09:00:00Z",
  observations: [
    { city: "Brisbane", period: "2026-07", annualPercent: 4.6, status: "" as const },
    { city: "Perth", period: "2026-07", annualPercent: 5.3, status: "" as const },
  ],
};
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-17T09:00:00Z"));
  vi.mocked(getCityApprovals).mockResolvedValue(data());
  vi.mocked(getCityRents).mockResolvedValue(rents);
});
afterEach(() => vi.useRealTimers());

it("supplies approvals with exact windows, geography and citations", async () => {
  const facts = await retrieveLocalFacts("Compare Brisbane and Perth dwelling approvals");
  expect(facts).toHaveLength(2);
  expect(facts[0]!.text).toContain("27628 dwellings approved, year to July 2026");
  expect(facts[0]!.text).toContain("not a single month's approvals");
  expect(facts[0]!.text).toContain("Greater Capital City Statistical Area");
  expect(facts[0]!.href).toBe("/markets?q=Brisbane&approvalPeriod=2026-07#housing-approvals");
  expect(facts[0]!.measureKind).toBe("dwelling-approvals");
});
it.each(["Brisbane approvals in January 2024", "Brisbane approvals in 2025",
  "Brisbane approvals in Q2 2026", "North Sydney approvals", "Sydney council approvals",
  "Townsville dwelling approvals"])("does not substitute a trailing capital year for %s", async question => {
  expect(await retrieveLocalFacts(question)).toEqual([]);
});
it("returns deterministic source balance whichever request finishes first", async () => {
  const orders: string[][] = [];
  for (const slow of ["rent", "approvals"]) {
    vi.mocked(getCityRents).mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve(rents), slow === "rent" ? 50 : 1);
    }));
    vi.mocked(getCityApprovals).mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve(data()), slow === "approvals" ? 50 : 1);
    }));
    const pending = retrieveLocalFacts("Compare Brisbane and Perth rents and dwelling approvals");
    await vi.advanceTimersByTimeAsync(60);
    orders.push((await pending).map(f => f.title));
  }
  expect(orders[0]).toEqual(orders[1]);
  expect(orders[0]).toHaveLength(4);
  expect(orders[0]!.slice(0, 2)).toEqual(["Brisbane: annual dwelling approvals", "Brisbane: annual CPI rent change"]);
});
it("retains other evidence on optional source failure or timeout", async () => {
  vi.mocked(getCityApprovals).mockRejectedValue(new Error("Fixture unavailable"));
  expect((await retrieveLocalFacts("Brisbane rents and approvals"))[0]!.cpiRent?.city).toBe("Brisbane");
  vi.mocked(getCityApprovals).mockReturnValue(new Promise(() => {}));
  const pending = retrieveLocalFacts("Brisbane rents and approvals");
  await vi.advanceTimersByTimeAsync(12000);
  expect((await pending)[0]!.cpiRent?.city).toBe("Brisbane");
});
it("pins an older window without treating it as current or replacing missing months", () => {
  expect(annualApprovals(data(), "Brisbane", "2027-01-01", "2026-07")?.total).toBe(27628);
  for (const period of ["2026-08", "2024-07", "2026-13", "", "2026-07-31"])
    expect(annualApprovals(data(), "Brisbane", "2026-09-17", period)).toBeNull();
  expect(annualApprovals(data(), "Brisbane", "2026-07-01", "2026-07")).toBeNull();
  expect(annualApprovals(data(), "Brisbane", "invalid", "2026-07")).toBeNull();
  const html = renderToStaticMarkup(createElement(CityApprovalRead, {
    data: data(), cities: ["Brisbane"], asOf: "2026-09-17", period: "2026-08",
  }));
  expect(html).toContain("Requested year-ending month: 2026-08");
  expect(html).not.toContain("27,628");
  expect(html).toContain("different period is not substituted");
});
it("distinguishes observation months from unknown publication dates and retains freshness gates", () => {
  const sources = comparisonEvidence.map(s => ({ ...s, date: "2026-08", dateKind: "observation" as const }));
  const row = structuredClone(comparisonAnswer.rows[0]!);
  expect(comparisonSourceDate(sources[0]!)).toBe("2026-08-31");
  expect(comparisonQuality(row, sources, "2026-09-07").comparable).toBe(true);
  expect(comparisonQuality(row, sources.map(s => ({ ...s, dateKind: "publication" as const })), "2026-09-07").comparable).toBe(false);
  for (const date of ["2026-09", "2026-07", "2024-08", "2026-13"])
    expect(comparisonQuality(row, sources.map(s => ({ ...s, date })), "2026-09-07").comparable).toBe(false);
  expect(observationPeriodEnd("2024-02")).toBe(Date.UTC(2024, 1, 29));
  expect(observationPeriodEnd("2026-13")).toBeNull();
});
it("cannot turn raw approval counts into a winning market claim", () => {
  const sources = comparisonEvidence.map(s => ({ ...s, measureKind: "dwelling-approvals" as const }));
  const view = groundComparison(comparisonAnswer, sources, "Brisbane", "Perth", comparisonNow)!;
  expect(view.rows.every(row => row.edge === "unclear")).toBe(true);
  expect(view.rows[0]!.read).toContain("not adjusted for population");
  expect(view.verdict).toBe("No clear edge on the available evidence.");
});
