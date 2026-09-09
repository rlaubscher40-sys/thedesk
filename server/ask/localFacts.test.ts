import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../markets/absRents", () => ({ getCityRents: vi.fn() }));
vi.mock("../db/planningSnapshots", () => ({ readPlanningSnapshots: vi.fn() }));
vi.mock("../db/localData", () => ({
  readLocalDataset: vi.fn(),
  readLocalDataHealth: vi.fn(),
}));
import { getCityRents } from "../markets/absRents";
import { readPlanningSnapshots } from "../db/planningSnapshots";
import { readLocalDataset } from "../db/localData";
import { retrieveLocalFacts } from "./localFacts";
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-09T08:00:00Z"));
  vi.mocked(readLocalDataset).mockResolvedValue(null);
  vi.mocked(getCityRents).mockResolvedValue({
    status: "available",
    retrievedAt: "2026-09-09T07:00:00Z",
    observations: [
      { city: "Sydney", period: "2026-07", annualPercent: 3, status: "" },
    ],
  });
  vi.mocked(readPlanningSnapshots).mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());
describe("optional local evidence", () => {
  it("uses the capital rent series with its actual definition", async () => {
    const facts = await retrieveLocalFacts("How fast are Sydney rents rising?");
    expect(facts).toHaveLength(1);
    expect(facts[0]!.text).toContain("not monthly growth");
  });
  it.each([
    "Sydney median weekly rent",
    "Sydney vacancy rate",
    "North Sydney rents",
    "Sydney suburb rents",
  ])("does not substitute CPI for %s", async (question) => {
    expect(await retrieveLocalFacts(question)).toEqual([]);
    expect(getCityRents).not.toHaveBeenCalled();
  });
  it("does not call extra sources for an unrelated question", async () => {
    expect(await retrieveLocalFacts("What changed in interest rates?")).toEqual(
      [],
    );
    expect(getCityRents).not.toHaveBeenCalled();
    expect(readLocalDataset).not.toHaveBeenCalled();
  });
  it("reads planning only for the named pilot council", async () => {
    await retrieveLocalFacts("Planning applications across NSW");
    expect(readPlanningSnapshots).not.toHaveBeenCalled();
    await retrieveLocalFacts("City of Sydney planning applications");
    expect(readPlanningSnapshots).toHaveBeenCalledWith(
      "Council of the City of Sydney",
      "2026-08-01",
      "2026-08-31",
    );
  });
  it("retains ready local facts when the optional CPI source stalls", async () => {
    vi.mocked(getCityRents).mockReturnValue(new Promise(() => {}));
    vi.mocked(readLocalDataset).mockImplementation(async (key) =>
      key === "nsw-bond-rents"
        ? {
            sourceKey: key,
            period: "2026-08-01",
            resourceUrl: "https://www.nsw.gov.au/file.xlsx",
            retrievedAt: "2026-09-09T07:00:00Z",
            fingerprint: "a".repeat(64),
            excludedRows: 0,
            areas: [
              {
                id: "test",
                name: "Glebe",
                state: "NSW",
                kind: "suburb",
                boundaryVersion: "fixture only",
                observations: [
                  {
                    measure: "weekly-rent",
                    value: 600,
                    unit: "AUD/week",
                    period: "2026-08-01",
                    category: "House 2",
                    sample: 20,
                    status: "published",
                  },
                ],
              },
            ],
          }
        : null,
    );
    const promise = retrieveLocalFacts("Compare Glebe and Sydney rents");
    await vi.advanceTimersByTimeAsync(12_000);
    expect(await promise).toMatchObject([
      { title: expect.stringContaining("Glebe") },
    ]);
  });
});
