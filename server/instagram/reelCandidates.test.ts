import { contextNow, testLoanRates, testMigration } from "./fixtures/contextReels";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { parseAbsApprovals } from "../markets/absApprovals";
import { RENT_CITIES } from "../../shared/cityRents";
const m = vi.hoisted(() => ({
  rents: vi.fn(),
  approvals: vi.fn(),
  balance: vi.fn(),
  demographics: vi.fn(),
  lending: vi.fn(),
}));
vi.mock("../markets/absDemographics", () => ({ getStateDemographics: m.demographics }));
vi.mock("../markets/reelLendingRates", () => ({ getReelLendingRates: m.lending }));
vi.mock("../markets/absRents", () => ({ getCityRents: m.rents }));
vi.mock("../markets/absApprovals", async (original) => ({
  ...(await original<typeof import("../markets/absApprovals")>()),
  getCityApprovals: m.approvals,
}));
vi.mock("../markets/housingBalance", () => ({ getHousingBalanceSnapshot: m.balance }));
import { HOUSING_BALANCE_SNAPSHOT } from "../../shared/housingBalance";
import {
  chooseReelCandidate,
  getVerifiedReelProgramme,
  getVerifiedReelCandidates,
} from "./reelCandidates";
beforeEach(() => {
  m.rents.mockResolvedValue({ status: "unavailable", retrievedAt: null, observations: [] });
  m.approvals.mockResolvedValue({ status: "unavailable", retrievedAt: null, observations: [] });
  m.balance.mockResolvedValue(null);
  m.demographics.mockResolvedValue({ status: "unavailable", retrievedAt: null, observations: [] });
  m.lending.mockResolvedValue([]);
});
describe("repeatable automatic editorial selection", () => {
  it("passes all six verified recipes through the shared production gate", async () => {
    const now = new Date("2026-09-10T12:00:00Z");
    m.rents.mockResolvedValue({
      status: "available",
      retrievedAt: now.toISOString(),
      observations: [
        ...RENT_CITIES.map((city, i) => ({
          city,
          annualPercent: 3 + i / 10,
          period: "2026-07",
          status: "",
        })),
        { city: "Sydney", annualPercent: 3.8, period: "2026-06", status: "" },
      ],
    });
    const approvals = parseAbsApprovals(
      readFileSync(new URL("../markets/fixtures/abs-approvals.csv", import.meta.url), "utf8"),
      now.toISOString()
    );
    approvals.observations = [
      ...approvals.observations.filter((row) => row.city !== "Sydney"),
      ...approvals.observations
        .filter((row) => row.city === "Brisbane")
        .map((row) => ({ ...row, city: "Sydney" as const })),
    ];
    m.approvals.mockResolvedValue(approvals);
    m.balance.mockResolvedValue(HOUSING_BALANCE_SNAPSHOT);
    const candidates = await getVerifiedReelCandidates(now);
    expect(candidates).toHaveLength(6);
    expect(new Set(candidates.map((candidate) => candidate.publication.key)).size).toBe(6);
  });
  it("adds borrowing and population families without requiring rent or approval evidence", async () => {
    m.demographics.mockResolvedValue(testMigration());
    m.lending.mockResolvedValue(testLoanRates());
    const candidates = await getVerifiedReelCandidates(contextNow);
    expect(candidates.map((c) => c.family)).toEqual(["borrowing", "population"]);
    expect(new Set(candidates.map((c) => c.publication.key)).size).toBe(2);
  });
  it("explains every withheld recipe without inventing a story", async () => {
    const programme = await getVerifiedReelProgramme();
    expect(programme).toHaveLength(8);
    expect(programme.every((p) => !p.candidate && p.requirement.length > 10)).toBe(true);
    expect(await getVerifiedReelCandidates()).toEqual([]);
  });
  it("can explain national supply and demand without substituting unavailable city data", async () => {
    m.balance.mockResolvedValue(HOUSING_BALANCE_SNAPSHOT);
    expect(await getVerifiedReelCandidates(new Date("2026-09-09T12:00:00Z"))).toEqual([]);
    const candidates = await getVerifiedReelCandidates(new Date("2026-09-10T12:00:00Z"));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.stat.value).toBe("~55,000");
    expect(candidates[0]!.stat.storyboard?.kind).toBe("housing-balance");
    expect(candidates[0]!.publication.date).toBe("2025-12-31");
  });
  it("selects freshest evidence then varies families without consuming a lock", () => {
    const candidates = [
      { family: "rents", publication: { date: "2026-07-01" } },
      { family: "rents", publication: { date: "2026-07-01" } },
      { family: "supply", publication: { date: "2026-07-01" } },
    ];
    const records = [
      { state: "published", publishedAt: new Date("2026-09-08") },
      { state: "available" },
      { state: "available" },
    ];
    expect(chooseReelCandidate(candidates, records)).toBe(2);
    candidates[1]!.publication.date = "2026-08-01";
    expect(chooseReelCandidate(candidates, records)).toBe(1);
    records[1]!.state = "locked";
    records[2]!.state = "published";
    expect(chooseReelCandidate(candidates, records)).toBe(-1);
  });
});
