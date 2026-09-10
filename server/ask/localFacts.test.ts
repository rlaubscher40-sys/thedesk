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
import { STATE_CODES, type LocalDataset } from "../../shared/localData";
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
  it.each(STATE_CODES)(
    "preserves state, SA2 boundary, period and citation for %s",
    async (state) => {
      // Same-name fixtures deliberately catch accidental cross-state matches.
      const data: LocalDataset = {
        sourceKey: "abs-sa2-population",
        period: "2025-06-30",
        resourceUrl: "https://www.abs.gov.au/data.xlsx",
        retrievedAt: "2026-09-09T07:00:00Z",
        fingerprint: "a".repeat(64),
        excludedRows: 0,
        areas: STATE_CODES.map((code, i) => ({
          id: `${code}:fixture`,
          name: "Test locality",
          state: code,
          kind: "SA2",
          boundaryVersion: "ASGS Edition 3",
          observations: [
            {
              measure: "population",
              value: 1000 + i,
              unit: "people",
              period: "2025-06-30",
              category: "All residents",
              sample: null,
              status: "published",
            },
          ],
        })),
      };
      vi.mocked(readLocalDataset).mockImplementation(async (key) =>
        key === data.sourceKey ? data : null,
      );
      const facts = await retrieveLocalFacts(
        `What is the population of Test locality SA2 in ${state}?`,
      );
      expect(facts).toHaveLength(1);
      expect(facts[0]!.text).toContain(
        `${1000 + STATE_CODES.indexOf(state)} people`,
      );
      expect(facts[0]!.text).toContain("ASGS Edition 3");
      expect(facts[0]!.href).toContain(
        `state=${state}&areaKind=SA2&period=2025-06-30`,
      );
      expect(facts[0]!.publisher).toBe("Australian Bureau of Statistics");
      expect(facts[0]!.date).toBe("2025-06-30");
    },
  );
  it("uses the capital rent series with its actual definition", async () => {
    const facts = await retrieveLocalFacts("How fast are Sydney rents rising?");
    expect(facts).toHaveLength(1);
    expect(facts[0]!.text).toContain("not monthly growth");
  });
  it("does not substitute July CPI for a requested January in the same year", async () => {
    expect(
      await retrieveLocalFacts(
        "How fast were Sydney rents rising in January 2026?",
      ),
    ).toEqual([]);
    expect(
      await retrieveLocalFacts(
        "How fast were Sydney rents rising in July 2026?",
      ),
    ).toHaveLength(1);
  });
  it("returns separate period-pinned CPI citations for an explicit month comparison", async () => {
    vi.mocked(getCityRents).mockResolvedValue({status:"available",retrievedAt:"2026-09-09T07:00:00Z", observations:[
      {city:"Sydney",period:"2026-06",annualPercent:3.1,status:""},
      {city:"Sydney",period:"2026-07",annualPercent:3,status:""},
    ]});
    const facts = await retrieveLocalFacts("Compare Sydney rent growth in June 2026 and July 2026");
    expect(facts.map(f => f.href)).toEqual([
      "/markets?q=Sydney&rentPeriod=2026-07#rental-conditions",
      "/markets?q=Sydney&rentPeriod=2026-06#rental-conditions",
    ]);
    expect(facts[1]!.text).toContain("Historical observation");
    expect(facts[1]!.text).toContain("3.1%");
  });
  it("can cite an old stored planning month without relabelling its age as current activity", async () => {
    vi.mocked(readPlanningSnapshots).mockResolvedValue([{
      councilName:"Council of the City of Sydney",from:"2025-08-01",to:"2025-08-31",completePagination:true,
      fingerprint:"b".repeat(64),retrievedAt:"2025-09-01T00:00:00Z",originalApplications:90,modifications:2,reviews:0,
      dwellings:{reported:200,missingApplications:20},
    }] as Awaited<ReturnType<typeof readPlanningSnapshots>>);
    const facts = await retrieveLocalFacts("City of Sydney planning applications in August 2025");
    expect(facts).toHaveLength(1);
    expect(facts[0]!.href).toBe(`/signals?planningPeriod=2025-08&planningRevision=${"b".repeat(64)}#nsw-planning`);
    expect(facts[0]!.text).toContain("not current activity");
    expect(readPlanningSnapshots).toHaveBeenCalledWith("Council of the City of Sydney","2025-08-01","2025-08-31");
  });
  it("does not substitute the current planning window for a historical request", async () => {
    vi.mocked(readPlanningSnapshots).mockResolvedValue([
      {
        from: "2026-08-01",
        to: "2026-08-31",
        councilName: "Council of the City of Sydney",
        fingerprint: "a".repeat(64),
        completePagination: true,
        retrievedAt: "2026-09-09T07:00:00Z",
        originalApplications: 92,
        modifications: 4,
        reviews: 0,
        dwellings: { reported: 268, missingApplications: 59 },
      },
    ] as Awaited<ReturnType<typeof readPlanningSnapshots>>);
    expect(
      await retrieveLocalFacts(
        "City of Sydney planning applications in August 2025",
      ),
    ).toEqual([]);
    const facts = await retrieveLocalFacts(
      "City of Sydney planning applications in August 2026",
    );
    expect(facts[0]!.text).toContain("not approvals or completions");
    expect(facts[0]!.href).toBe(`/signals?planningPeriod=2026-08&planningRevision=${"a".repeat(64)}#nsw-planning`);
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
