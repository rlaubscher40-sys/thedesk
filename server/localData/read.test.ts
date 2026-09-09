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
    expect(localFactEvidence(match)[0]?.href).toContain(
      "state=ACT&areaKind=SA2",
    );
    expect(localFactEvidence(match)[0]?.text).toContain("Do not extend");
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
    expect(
      localFactEvidence(match, "Rents in postcode 2000")[0]?.text,
    ).toContain("withheld: insufficient-sample");
    expect(localFactEvidence(match, "Rents in postcode 2000")[0]?.withheldRent).toBe(true);
    expect(
      localFactEvidence(match, "Rents in postcode 2000")[0]?.text,
    ).not.toContain("500 AUD/week");
    expect(
      localFactEvidence(match, "Rents in postcode 2000 in 2025")[0]?.text,
    ).toContain("500 AUD/week");
    const historic = localFactEvidence(
      match,
      "Rents in postcode 2000 in 2025",
    )[0]!;
    expect(historic.href).toContain("period=2025-08-01");
    expect(historic.withheldRent).toBe(false);
    expect(historic.text).toContain("Historical reporting period");
    expect(historic.text).not.toContain(
      "Latest available in this stored source release",
    );
    expect(
      localFactEvidence(
        match,
        "Rents in postcode 2000 for reporting period 2025-08-01",
      )[0]?.date,
    ).toBe("2025-08-01");
    expect(
      localFactEvidence(
        match,
        "Rents in postcode 2000 for reporting period 2025-03-31",
      ),
    ).toEqual([]);
  });
  it("does not substitute another quarter in the requested year", () => {
    const data = dataset([area("4000", "QLD", "postcode")]);
    data.sourceKey = "qld-bond-rents";
    const match = matchLocalAreas("4000", [data])[0]!;
    expect(
      localFactEvidence(match, "Rents in postcode 4000 QLD in March 2025"),
    ).toEqual([]);
    expect(
      localFactEvidence(match, "Rents in postcode 4000 QLD in June 2025")[0]
        ?.href,
    ).toContain("period=2025-06-30");
  });
  it("gives each comparison period its own verifiable citation", () => {
    const data = dataset([area("4000", "QLD", "postcode")]);
    data.sourceKey = "qld-bond-rents";
    data.period = "2026-06-30";
    data.areas[0]!.observations = [
      {
        measure: "weekly-rent",
        value: 800,
        unit: "AUD/week",
        period: "2025-06-30",
        category: "Flat 2",
        sample: 345,
        status: "published",
      },
      {
        measure: "weekly-rent",
        value: 850,
        unit: "AUD/week",
        period: "2026-06-30",
        category: "Flat 2",
        sample: 287,
        status: "published",
      },
    ];
    const facts = localFactEvidence(
      matchLocalAreas("4000", [data])[0]!,
      "Compare 2-bedroom flat rents in postcode 4000 in June 2025 and June 2026",
    );
    expect(facts.map((f) => f.date)).toEqual(["2026-06-30", "2025-06-30"]);
    for (const fact of facts)
      expect(fact.href).toContain(`period=${fact.date}`);
    expect(facts[0]!.text).toContain("850 AUD/week");
    expect(facts[0]!.text).not.toContain("800 AUD/week");
    expect(facts[1]!.text).toContain("800 AUD/week");
    expect(facts[1]!.text).not.toContain("850 AUD/week");
    expect(facts[1]!.text).toContain(
      "Latest stored release period: 2026-06-30",
    );
  });
});
