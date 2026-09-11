import type { RbaHousingRate } from "../../../scripts/ingest/lib/rbaHousingRates";
import type { StateDemographics } from "../../../shared/stateDemographics";
/** Synthetic edge-test inputs. Never used by the production registry. */
export const contextNow = new Date("2026-09-11T08:00:00Z");
export const testLoanRates = (): RbaHousingRate[] => [
  {
    seriesId: "FLRHOFTA",
    title: "Synthetic owner-occupier series",
    rate: 6.24,
    period: new Date("2026-07-31"),
    publicationDate: new Date("2026-09-07"),
  },
  {
    seriesId: "FLRHIFTA",
    title: "Synthetic investor series",
    rate: 6.41,
    period: new Date("2026-07-31"),
    publicationDate: new Date("2026-09-07"),
  },
];
export function testMigration(): StateDemographics {
  return {
    status: "available",
    retrievedAt: contextNow.toISOString(),
    observations: ["Queensland", "Western Australia"].flatMap((state, i) => [
      ...["2024-Q4", "2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4"].map((period) => ({
        state,
        period,
        measure: "population" as const,
        people: 3_000_000 + i * 1_000_000,
        status: "",
      })),
      ...["2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4"].flatMap((period) => [
        {
          state,
          period,
          measure: "netInternalMigration" as const,
          people: i ? 2500 : 4000,
          status: "",
        },
        { state, period, measure: "netOverseasMigration" as const, people: 5000, status: "" },
      ]),
    ]),
  };
}
