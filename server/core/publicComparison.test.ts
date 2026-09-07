import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import type { Express, Request, Response, NextFunction } from "express";
import type { CityRents } from "../../shared/cityRents";
import { PUBLIC_COMPARISON_PATH, comparisonRentSummary } from "../../shared/PublicComparisonRead";
vi.mock("../markets/absRents", () => ({ getCityRents: vi.fn() }));
import { getCityRents } from "../markets/absRents";
import { publicComparisonCard, publicComparisonShell, registerMarketSeoRoutes } from "./marketSeo";
const data: CityRents = {
  status: "available",
  retrievedAt: "2026-09-07T00:00:00Z",
  observations: [
    { city: "Brisbane", annualPercent: 4.6, period: "2026-07", status: "" },
    { city: "Perth", annualPercent: 5.3, period: "2026-07", status: "" },
  ],
};
const shell = '<html><head><title>The Desk</title></head><body><div id="root"></div></body></html>';
describe("free public comparison", () => {
  it("renders a same-period read, evidence gaps and canonical metadata before JavaScript", () => {
    const html = publicComparisonShell(shell, data, "2026-09-07", "https://thedesk.au");
    expect(html).toContain("0.7 percentage points higher");
    expect(html).toContain("year to July 2026");
    expect(html).toContain("Housing supply");
    expect(html).toContain("Population &amp; demand");
    expect(html).toContain("No account or question allowance needed");
    expect(html).toContain(`rel="canonical" href="https://thedesk.au${PUBLIC_COMPARISON_PATH}"`);
    expect(html).toContain("ABS release &amp; methodology");
    expect(html).not.toContain("noindex");
  });
  it("never states a current gap for stale, missing or mismatched observations", () => {
    for (const invalid of [
      { ...data, observations: [] },
      { ...data, observations: [data.observations[0]!] },
      {
        ...data,
        observations: data.observations.map((row) => ({
          ...row,
          period: row.city === "Perth" ? "2026-06" : row.period,
        })),
      },
    ]) {
      expect(comparisonRentSummary(invalid, "2026-09-07")).toContain("unavailable");
      expect(publicComparisonShell(shell, invalid, "2026-09-07", "https://thedesk.au")).toContain(
        "noindex"
      );
    }
    expect(comparisonRentSummary(data, "2027-01-01")).toContain("unavailable");
  });
  it("handles equal growth without implying an investment winner", () => {
    const equal = {
      ...data,
      observations: data.observations.map((row) => ({ ...row, annualPercent: 4.6 })),
    };
    expect(comparisonRentSummary(equal, "2026-09-07")).toContain("growth rates were equal");
    expect(comparisonRentSummary(equal, "2026-09-07")).toContain(
      "not which city is the better investment"
    );
  });
});

describe("public comparison HTTP route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });
  it("serves link unfurlers without accepting generated claims from query parameters", async () => {
    const handlers = new Map<
      string,
      (req: Request, res: Response, next: NextFunction) => unknown
    >();
    registerMarketSeoRoutes({
      get: (path: string, fn: never) => handlers.set(path, fn),
    } as unknown as Express);
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs.promises, "readFile").mockResolvedValue(shell);
    vi.mocked(getCityRents).mockResolvedValue(data);
    const res = {
      set: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
    await handlers.get(PUBLIC_COMPARISON_PATH)!(
      {
        headers: { accept: "*/*" },
        query: { headline: "Guaranteed winner" },
      } as unknown as Request,
      res as unknown as Response,
      vi.fn()
    );
    expect(res.send.mock.calls[0]?.[0]).toContain("Brisbane vs Perth");
    expect(res.send.mock.calls[0]?.[0]).not.toContain("Guaranteed winner");
  });
});

it("builds a dated comparison card only from comparable observations", () => {
  expect(publicComparisonCard(data, "2026-09-07")).toMatchObject({
    figure: "0.7pp",
    feedDate: "2026-07",
    source: "Australian Bureau of Statistics",
  });
  expect(publicComparisonCard(data, "2027-01-01")).toBeNull();
  expect(publicComparisonCard({ ...data, observations: [] }, "2026-09-07")).toBeNull();
});
