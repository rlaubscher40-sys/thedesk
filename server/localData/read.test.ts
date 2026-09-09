import { describe, expect, it, vi } from "vitest";
vi.mock("../db/localData", () => ({
  readLocalDataset: vi.fn(),
  readLocalDataHealth: vi.fn(),
}));
import { localFactEvidence, matchLocalAreas } from "./read";
import type { LocalArea, LocalDataset } from "../../shared/localData";
const area = (
  name: string,
  state: LocalArea["state"] = "NSW",
  kind: LocalArea["kind"] = "SA2",
): LocalArea => ({
  id: `${state}:${kind}:${name}`,
  name,
  state,
  kind,
  boundaryVersion: "2021",
  observations: [
    {
      measure: "population",
      value: 1000,
      unit: "people",
      period: "2025-06-30",
      category: "All residents",
      sample: null,
      status: "published",
    },
  ],
});
const dataset = (areas: LocalArea[]): LocalDataset => ({
  sourceKey: "abs-sa2-population",
  period: "2025-06-30",
  resourceUrl: "https://www.abs.gov.au/data.xlsx",
  fingerprint: "f".repeat(64),
  retrievedAt: "2026-09-09T00:00:00Z",
  areas,
  excludedRows: 0,
});
describe("geographic fact retrieval", () => {
  it("does not pick a namesake across states in Ask", () => {
    const data = [dataset([area("Cambridge", "TAS"), area("Cambridge", "WA")])];
    expect(
      matchLocalAreas("Cambridge population", data, { question: true }),
    ).toEqual([]);
    expect(
      matchLocalAreas("Cambridge Tasmania population", data, {
        question: true,
      }).map((m) => m.area.state),
    ).toEqual(["TAS"]);
  });
  it("keeps the longer named area rather than selecting its smaller namesake", () => {
    const data = [
      dataset([area("Adelaide", "SA"), area("North Adelaide", "SA")]),
    ];
    expect(
      matchLocalAreas("North Adelaide population", data, {
        question: true,
      }).map((m) => m.area.name),
    ).toEqual(["North Adelaide"]);
  });
  it("never substitutes a capital's namesake statistical area for the whole city", () => {
    const data = [dataset([area("Adelaide", "SA")])];
    expect(
      matchLocalAreas("Adelaide population", data, { question: true }),
    ).toEqual([]);
    expect(
      matchLocalAreas("Adelaide SA2 population", data, { question: true }),
    ).toHaveLength(1);
  });
  it("requires explicit postcode context in questions, avoiding dates mistaken for locations", () => {
    const data = [dataset([area("2025", "NSW", "postcode")])];
    expect(
      matchLocalAreas("What happened in 2025?", data, { question: true }),
    ).toEqual([]);
    expect(
      matchLocalAreas("Rents in postcode 2025", data, { question: true }),
    ).toHaveLength(1);
  });
  it("matches exact area searches with state and type retained in their source links", () => {
    const match = matchLocalAreas("Aranda ACT", [
      dataset([area("Aranda", "ACT")]),
    ])[0]!;
    expect(localFactEvidence(match)?.href).toContain("state=ACT&areaKind=SA2");
    expect(localFactEvidence(match)?.text).toContain("Do not extend");
  });
  it("does not answer from a prior-year median when the newest one is suppressed", () => {
    const data = dataset([area("2000", "NSW", "postcode")]);
    data.sourceKey = "nsw-bond-rents";
    data.period = "2026-08-01";
    data.areas[0]!.observations = [
      {
        measure: "weekly-rent",
        value: null,
        unit: "AUD/week",
        period: data.period,
        category: "Flat/unit · 1 bedrooms",
        sample: 9,
        status: "insufficient-sample",
      },
      {
        measure: "weekly-rent",
        value: 500,
        unit: "AUD/week",
        period: "2025-08-01",
        category: "Flat/unit · 1 bedrooms",
        sample: 20,
        status: "published",
      },
    ];
    const match = matchLocalAreas("2000", [data])[0]!;
    expect(localFactEvidence(match, "Rents in postcode 2000")).toBeNull();
    expect(
      localFactEvidence(match, "Rents in postcode 2000 in 2025")?.text,
    ).toContain("500 AUD/week");
    const historic = localFactEvidence(
      match,
      "Rents in postcode 2000 in 2025",
    )!;
    expect(historic.href).toContain("period=2025-08-01");
    expect(historic.text).toContain("Historical reporting period");
    expect(historic.text).not.toContain(
      "Latest available in this stored source release",
    );
    expect(
      localFactEvidence(
        match,
        "Rents in postcode 2000 for reporting period 2025-08-01",
      )?.date,
    ).toBe("2025-08-01");
    expect(
      localFactEvidence(
        match,
        "Rents in postcode 2000 for reporting period 2025-03-31",
      ),
    ).toBeNull();
  });
});
