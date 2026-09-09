import { expect, it } from "vitest";
import { parseSaBonds, parseTasBonds, parseWaBonds } from "./stateRents";
import { parseRentCsv, parseWaArchive } from "./waArchive";
import { selectRentResource } from "./rentResources";
import { sourceHostAllowed } from "./fetch";
import { localPeriodLabel, localSampleLabel } from "../../shared/localData";

function saRows() {
  const rows: unknown[][] = Array.from({ length: 17 }, () =>
    Array(27).fill(null),
  );
  rows[8]![0] = "Where there are 1 to 5 dwellings";
  rows[9]![0] = "rounded to nearest 5";
  rows[13]![0] =
    "median weekly rental, 1 April - 30 June 2026, South Australia";
  for (const [c, type] of [
    [1, "Flats/Units"],
    [11, "Houses"],
  ] as const) {
    rows[14]![c] = type;
    for (let i = 0; i < 4; i++) {
      const j = c + i * 2;
      rows[15]![j] =
        `${i + 1}${i === 3 ? "+" : ""} bedroom${i === 0 ? "" : "s"}`;
      rows[16]![j] = "Count";
      rows[16]![j + 1] = "Median";
    }
  }
  return rows;
}
it("keeps SA rounded counts separate from exact samples and withholds small groups", () => {
  const suburb = saRows(),
    pc = saRows();
  suburb.push(["Adelaide", 15, 500, 10, 600, "*", 700]);
  pc.push([5000, 20, 550]);
  const d = parseSaBonds(
    [
      { sheet: "Suburb", data: suburb },
      { sheet: "PC", data: pc },
    ],
    "2026-06",
  );
  expect(d.areas[0]!.observations.map((o) => o.value)).toEqual([
    500,
    null,
    null,
  ]);
  expect(d.areas[0]!.observations[1]!.sample).toBe(10);
  expect(d.period).toBe("2026-06-30");
});
it("excludes SA postcodes split across source regions instead of averaging medians", () => {
  const suburb = saRows(),
    pc = saRows();
  suburb.push(["Adelaide", 15, 500]);
  pc.push([5118, 20, 400], [5118, 20, 600], [5000, 20, 550]);
  const d = parseSaBonds(
    [
      { sheet: "Suburb", data: suburb },
      { sheet: "PC", data: pc },
    ],
    "2026-06",
  );
  expect(d.excludedRows).toBe(2);
  expect(d.areas.map((a) => a.name)).not.toContain("5118");
  expect(() =>
    parseSaBonds(
      [
        { sheet: "Suburb", data: suburb },
        { sheet: "PC", data: pc },
      ],
      "2026-03",
    ),
  ).toThrow("quarter");
});
const tasHeader = [
  "Suburb",
  "State",
  "Postcode",
  "Bond Amount",
  "Weekly Rent",
  "Bond Lodgement date",
  "Bond Activation date",
  "Number of Bedrooms",
  "Dwelling / Premises Type",
  "Length of Tenancy (In Months)",
  "Housing Type",
];
const tasRow = (value = 500) => [
  "HOBART",
  "Tasmania",
  "7000",
  2000,
  value,
  new Date("2026-06-15T00:00:00Z"),
  new Date("2026-06-16T00:00:00Z"),
  2,
  "Unit",
  12,
  "Private housing",
];
it("uses only Tasmania private active-sheet new bonds and keeps closed bonds out", () => {
  const community = tasRow(10);
  community[10] = "Community housing";
  const rows = [
    ["Active"],
    tasHeader,
    ...Array.from({ length: 10 }, (_, i) => tasRow(500 + i * 10)),
    community,
  ];
  const d = parseTasBonds(
    [
      { sheet: "Active Bonds", data: rows },
      { sheet: "Closed Bonds", data: [tasRow(1)] },
    ],
    "2026-06",
  );
  expect(d.areas[0]!.observations[0]).toMatchObject({
    value: 545,
    sample: 10,
    category: "Flat 2 bedrooms",
  });
  expect(d.excludedRows).toBe(1);
  expect(() =>
    parseTasBonds([{ sheet: "Active Bonds", data: rows }], "2026-05"),
  ).toThrow("date");
});
const waHeader = [
  "LODGEMENT DATE",
  "LOCALITY NAME",
  "POSTCODE",
  "WEEKLY RENT AMOUNT",
];
it("calculates WA postcode medians without inventing dwelling categories", () => {
  const rows = [
    waHeader,
    ...Array.from({ length: 10 }, (_, i) => [
      "01-AUG-26",
      "PERTH",
      "6000",
      String(600 + i * 10),
    ]),
    ["02-AUG-26", "ALBANY", "6330", "500"],
  ];
  const d = parseWaBonds(rows, "2026-08");
  expect(d.areas[0]!.observations[0]).toMatchObject({
    value: 645,
    sample: 10,
    category: "All dwellings",
  });
  expect(d.areas[1]!.observations[0].value).toBeNull();
  rows[1]![0] = "01-JUL-26";
  expect(() => parseWaBonds(rows, "2026-08")).toThrow("date");
});
it("parses quoted CSV fields and rejects malformed quoting", () => {
  expect(parseRentCsv('"a","b,b","say ""hi""",4\r\n')).toEqual([
    ["a", "b,b", 'say "hi"', "4"],
  ]);
  expect(() => parseRentCsv('"unfinished')).toThrow("Unclosed");
  expect(() => parseRentCsv('"closed"extra,3')).toThrow("Invalid");
});
it("rejects non-ZIP archives before decompression", async () => {
  await expect(
    parseWaArchive(Buffer.from("not a zip"), "2026-08"),
  ).rejects.toThrow();
});
it("discovers Tasmania resource dates regardless of the catalogue folder year", () => {
  const d = {
    name: "rental-bond-and-rental-data-july-2024-to-june-2025",
    organization: { name: "department-of-justice-tasmania" },
    license_id: "cc-by-4.0",
    resources: [
      {
        url: "https://data.gov.au/data/dataset/a/resource/b/download/abs-report-june-2026.xlsx",
      },
    ],
  };
  const data = { success: true, result: { count: 1, results: [d] } };
  expect(
    selectRentResource(
      "tas-bond-rents",
      JSON.stringify(data),
      new Date("2026-09-09"),
    ).period,
  ).toBe("2026-06");
  d.license_id = "other";
  expect(() =>
    selectRentResource(
      "tas-bond-rents",
      JSON.stringify(data),
      new Date("2026-09-09"),
    ),
  ).toThrow("licensed");
});
it("requires a complete catalogue and unambiguous, completed SA release", () => {
  const url =
    "https://data.sa.gov.au/data/dataset/a/resource/b/download/private-rental-report-2026-06.xlsx";
  const d = {
    name: "private-rent-report",
    license_id: "cc-by",
    resources: [{ url }, { url: url.replace("-06.xlsx", "-09.xlsx") }],
  };
  expect(
    selectRentResource(
      "sa-bond-rents",
      JSON.stringify({ success: true, result: d }),
      new Date("2026-09-09"),
    ).period,
  ).toBe("2026-06");
  expect(() =>
    selectRentResource(
      "tas-bond-rents",
      JSON.stringify({ success: true, result: { count: 101, results: [] } }),
      new Date(),
    ),
  ).toThrow("incomplete");
});
it("allows only the registered WA bucket and rental prefix", () => {
  const url = new URL(
    "https://ahdap-public-data.s3.ap-southeast-2.amazonaws.com/RentalBondsWA/wa-rental-bond-aug2026.zip",
  );
  expect(sourceHostAllowed(url, "wa-bond-rents")).toBe(true);
  expect(sourceHostAllowed(url, "sa-bond-rents")).toBe(false);
  url.pathname = "/private/file.zip";
  expect(sourceHostAllowed(url, "wa-bond-rents")).toBe(false);
  url.hostname = "evil.example";
  expect(sourceHostAllowed(url, "wa-bond-rents")).toBe(false);
});
it("labels monthly and quarterly observations and rounded counts explicitly", () => {
  expect(localPeriodLabel("wa-bond-rents", "2026-08-31")).toBe("August 2026");
  expect(localPeriodLabel("sa-bond-rents", "2026-06-30")).toBe(
    "Quarter ended 30 June 2026",
  );
  expect(localSampleLabel("sa-bond-rents")).toBe("Bonds (rounded)");
});
