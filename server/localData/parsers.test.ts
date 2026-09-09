import { describe, expect, it } from "vitest";
import {
  parseLocalPopulation,
  parseNswBonds,
  parseQldBonds,
  type Sheet,
} from "./parsers";
import { validateWorkbookZip } from "./workbook";

function nsw(n = 10): Sheet[] {
  return [
    {
      sheet: "August26 Rental Bond Lodgments",
      data: [
        ["NSW Fair Trading\nResidential Rental Bond Lodgements\nAugust 2026"],
        [],
        [
          "Lodgement Date",
          "Postcode",
          "Dwelling Type",
          "Bedrooms",
          "Weekly Rent",
        ],
        ...Array.from({ length: n }, (_, i) => [
          new Date("2026-08-03T00:00:00Z"),
          2000,
          "F",
          "0",
          String(500 + i * 10),
        ]),
      ],
    },
  ];
}
function population(): Sheet[] {
  return Array.from({ length: 8 }, (_, i) => ({
    sheet: `Table ${i + 1}`,
    data: [
      [],
      [
        "Estimated resident population and components, Statistical Areas Level 2",
      ],
      ["Regional population, 2024–25"],
      [],
      [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        2024,
        2025,
        "2024–25",
        null,
        "Natural increase",
        "Net internal migration",
        "Net overseas migration",
      ],
      [null, null, null, null, null, null, "SA2 code", "SA2 name"],
      [
        null,
        null,
        null,
        null,
        null,
        null,
        `${i + 1}01011001`,
        `Area ${i}`,
        1000,
        1020,
        20,
        2,
        10,
        -5,
        15,
      ],
      [null, null, null, null, null, null, null, "Total state", 1000, 1020],
    ],
  }));
}
function qld(): Sheet[] {
  const files: Sheet[] = [
    {
      sheet: "Contents",
      data: [["https://creativecommons.org/licenses/by/4.0/"]],
    },
  ];
  for (const [rents, counts, label, name] of [
    ["1 pc-rents", "2 pc-new-bonds", "Postcode", 4000],
    ["4 sub-rents", "5 sub-new-bonds", "Suburb", "Acacia Ridge"],
    [
      "7 lga-rents ",
      "8 lga-new-bonds",
      "Local Government Area",
      "Brisbane (C)",
    ],
  ]) {
    for (const [sheet, values] of [
      [rents, [500, null]],
      [counts, [20, 9]],
    ] as const)
      files.push({
        sheet: String(sheet),
        data: [
          [],
          [],
          [],
          [],
          [null, null, label, "Dwelling"],
          [null, null, null, null, "Jun", "Jun"],
          [null, null, null, null, 2025, 2026],
          [],
          [null, null, name, "Flat 1", ...values],
        ],
      });
  }
  return files;
}
describe("source-defined local data", () => {
  it("calculates the NSW median using valid observations and retains zero-bedroom studios", () => {
    const input = nsw();
    input[0]!.data.push([new Date("2026-08-03"), 2000, "U", "U", "U"]);
    const result = parseNswBonds(input, "2026-08");
    expect(result.excludedRows).toBe(1);
    expect(result.areas[0]).toMatchObject({
      kind: "postcode",
      state: "NSW",
      observations: [
        { value: 545, sample: 10, category: "Flat/unit · 0 bedrooms" },
      ],
    });
  });
  it("withholds a small NSW group and never treats unknown rents as zero", () => {
    const input = nsw(9);
    input[0]!.data.push([new Date("2026-08-03"), 2000, "F", "0", "U"]);
    expect(
      parseNswBonds(input, "2026-08").areas[0]!.observations[0],
    ).toMatchObject({ value: null, sample: 9, status: "insufficient-sample" });
  });
  it("rejects the wrong NSW month and source schema", () => {
    expect(() => parseNswBonds(nsw(), "2026-07")).toThrow("month mismatch");
    const data = nsw();
    data[0]!.data[3]![0] = new Date("2026-07-31");
    expect(() => parseNswBonds(data, "2026-08")).toThrow(
      "outside reporting month",
    );
  });
  it("requires and reconciles all eight population jurisdictions", () => {
    const result = parseLocalPopulation(population(), 2025);
    expect(new Set(result.areas.map((a) => a.state)).size).toBe(8);
    expect(
      result.areas[0]!.observations.find(
        (o) => o.measure === "internal-migration",
      )?.value,
    ).toBe(-5);
    expect(() => parseLocalPopulation(population().slice(0, 7), 2025)).toThrow(
      "worksheet",
    );
    const bad = population();
    bad[0]!.data[6]![14] = 16;
    expect(() => parseLocalPopulation(bad, 2025)).toThrow("reconcile");
  });
  it("rejects an incomplete state, incorrect geography or reporting year", () => {
    const bad = population();
    bad[0]!.data[7]![9] = 999;
    expect(() => parseLocalPopulation(bad, 2025)).toThrow("total");
    expect(() => parseLocalPopulation(population(), 2026)).toThrow("year");
    const wrong = population();
    wrong[0]!.data[1]![0] = "Local Government Areas";
    expect(() => parseLocalPopulation(wrong, 2025)).toThrow("geography");
  });
  it("keeps a suppressed latest QLD rent missing even when last year's median exists", () => {
    const result = parseQldBonds(qld());
    expect(result.areas).toHaveLength(3);
    expect(result.areas[0]!.observations).toMatchObject([
      { value: 500, period: "2025-06-30" },
      { value: null, status: "suppressed", sample: 9, period: "2026-06-30" },
    ]);
  });
  it("rejects a changed QLD licence and mismatched count periods", () => {
    const input = qld();
    input[0]!.data = [];
    expect(() => parseQldBonds(input)).toThrow("licence");
    const bad = qld();
    bad[2]!.data[6]![5] = 2025;
    expect(() => parseQldBonds(bad)).toThrow("periods differ");
  });
  it("rejects non-workbooks and oversized inputs before parsing", () => {
    expect(() =>
      validateWorkbookZip(Buffer.from("<html>Access denied</html>")),
    ).toThrow();
    expect(() => validateWorkbookZip(Buffer.alloc(10_000_001))).toThrow("size");
  });
});
