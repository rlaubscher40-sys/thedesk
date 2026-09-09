import { describe, it, expect, vi, beforeEach } from "vitest";
const m = vi.hoisted(() => ({ rents: vi.fn(), approvals: vi.fn(), balance: vi.fn() }));
vi.mock("../markets/absRents", () => ({ getCityRents: m.rents }));
vi.mock("../markets/absApprovals", () => ({ getCityApprovals: m.approvals }));
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
});
describe("repeatable automatic editorial selection", () => {
  it("explains every withheld recipe without inventing a story", async () => {
    const programme = await getVerifiedReelProgramme();
    expect(programme).toHaveLength(6);
    expect(programme.every((p) => !p.candidate && p.requirement.length > 10)).toBe(true);
    expect(await getVerifiedReelCandidates()).toEqual([]);
  });
  it("can explain national supply and demand without substituting unavailable city data", async () => {
    m.balance.mockResolvedValue(HOUSING_BALANCE_SNAPSHOT);
    const candidates = await getVerifiedReelCandidates(new Date("2026-09-09T12:00:00Z"));
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
