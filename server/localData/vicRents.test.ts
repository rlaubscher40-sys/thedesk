import { beforeEach, expect, it, vi } from "vitest";
import fixture from "./fixtures/vic-lga-sep2025.json";
import { parseVicRents } from "./vicRents";
import type { Sheet } from "./parsers";
import release from "./releases/vic-2025-09";
import { localFactEvidence, matchLocalAreas } from "./read";
import { localObservationCoverage } from "../../shared/localCoverage";
import { LOCAL_SOURCE_KEYS, localDatasetIsOlder } from "../../shared/localData";
import { directLocalRentAnswer } from "../ask/directLocalRent";
vi.mock("../db/localData", () => ({
  readLocalDataset: vi.fn(),
  writeLocalDataset: vi.fn(),
  markLocalDataCheck: vi.fn(),
}));
import { readLocalDataset, writeLocalDataset, markLocalDataCheck } from "../db/localData";
import {
  REVIEWED_VIC_JOB,
  importReviewedVicRelease,
  reviewedVicReleasePending,
} from "./reviewedRelease";
import { isCollectionJob } from "../db/collectionRuns";

const source = () => structuredClone(fixture) as Sheet[];
const parse = (s = source()) => parseVicRents(s, "2025-09-30");
const now = new Date("2026-09-10T00:00:00Z");

it("matches the full-workbook generated release using actual reduced source cells", () => {
  const result = parse();
  expect(result).toEqual({
    areas: release.areas,
    period: release.period,
    excludedRows: release.excludedRows,
  });
  expect(result.areas).toHaveLength(79);
  expect(new Set(result.areas.map((a) => a.id)).size).toBe(79);
  expect(result.excludedRows).toBe(84);
  expect(
    result.areas.every((a) => a.kind === "LGA" && a.state === "VIC" && a.observations.length === 35)
  ).toBe(true);
  expect(localObservationCoverage(release)).toEqual({
    published: 2297,
    notPublished: 0,
    insufficientSample: 0,
    sourceUnavailable: 468,
  });
  expect(
    result.areas
      .flatMap((a) => a.observations)
      .filter((o) => o.period === release.period && o.value !== null)
  ).toHaveLength(457);
  expect(result.areas.find((a) => a.name === "Mornington Peninsula")).toBeDefined();
});

it("retains published small counts and source dashes without guessing a suppression reason", () => {
  const area = parse().areas.find((a) => a.name === "Queenscliffe")!;
  expect(
    area.observations.find((o) => o.category === "All properties" && o.period === release.period)
  ).toMatchObject({ value: 575, sample: 5, status: "published" });
  expect(
    area.observations.find((o) => o.category === "House 3 bedrooms" && o.period === release.period)
  ).toMatchObject({ value: null, sample: null, status: "source-unavailable" });
});

it.each([
  [
    "wrong table",
    (s: Sheet[]) => {
      s[0]!.data[0]![0] = "Moving annual rents by suburb";
    },
  ],
  [
    "wrong category",
    (s: Sheet[]) => {
      s[0]!.data[1]![0] = "2 bedroom flats";
    },
  ],
  [
    "wrong column",
    (s: Sheet[]) => {
      s[0]!.data[2]![10] = "Median";
    },
  ],
  [
    "incomplete quarter pair",
    (s: Sheet[]) => {
      s[0]!.data[1]![11] = "Jun 2025";
    },
  ],
  [
    "duplicate quarter",
    (s: Sheet[]) => {
      s[0]!.data[1]![8] = "Mar 2025";
      s[0]!.data[1]![9] = "Mar 2025";
    },
  ],
  [
    "wrong geography",
    (s: Sheet[]) => {
      s[0]!.data[3]![1] = "Invented suburb";
    },
  ],
  [
    "missing council",
    (s: Sheet[]) => {
      s[0]!.data.splice(3, 1);
    },
  ],
  [
    "duplicate council",
    (s: Sheet[]) => {
      s[0]!.data.push([...s[0]!.data[3]!]);
    },
  ],
  [
    "blank median",
    (s: Sheet[]) => {
      s[0]!.data[3]![11] = null;
    },
  ],
  [
    "negative median",
    (s: Sheet[]) => {
      s[0]!.data[3]![11] = -1;
    },
  ],
  [
    "numeric text",
    (s: Sheet[]) => {
      s[0]!.data[3]![11] = "290";
    },
  ],
  [
    "footnote",
    (s: Sheet[]) => {
      s[0]!.data[3]![11] = "290*";
    },
  ],
  [
    "zero count and published median",
    (s: Sheet[]) => {
      s[0]!.data[3]![10] = 0;
    },
  ],
  [
    "duplicate sheet",
    (s: Sheet[]) => {
      s[1] = structuredClone(s[0]!);
    },
  ],
] as const)("rejects %s", (_name, mutate) => {
  const s = source();
  mutate(s);
  expect(() => parse(s)).toThrow("Victoria rents:");
});
it("rejects another release instead of redating the historical file", () => {
  expect(() => parseVicRents(source(), "2026-06-30")).toThrow("release period");
});

it("cites the exact council, category and quarter through Ask's deterministic answer", () => {
  const [match] = matchLocalAreas(
    "What was the median weekly rent for 3 bedroom houses in Mildura LGA VIC in September 2025?",
    [release],
    { question: true },
    now
  );
  expect(match!.older).toBe(true);
  expect(match!.acquisition).toBe("user-upload");
  const question =
    "What was the median weekly rent for 3 bedroom houses in Mildura LGA VIC in September 2025?";
  const facts = localFactEvidence(match!, question);
  expect(facts).toHaveLength(1);
  expect(facts[0]!.href).toContain("areaKind=LGA&period=2025-09-30");
  expect(facts[0]!.sourceUrl).toBe(release.resourceUrl);
  expect(facts[0]!.text).toContain("Older reporting period");
  expect(facts[0]!.text).toContain("Supplied workbook received for review");
  expect(directLocalRentAnswer(question, facts)?.answer).toContain(
    "$490/week, Quarter ended 30 September 2025"
  );
  expect(directLocalRentAnswer(question, facts)?.answer).toContain("Reported count: 210");
});
it("keeps council data out of capital, suburb and postcode substitutions", () => {
  for (const question of [
    "median rent in Melbourne VIC",
    "median rent in Mildura suburb VIC",
    "weekly rent in postcode 3000 VIC",
    "median rent in Victoria",
  ])
    expect(matchLocalAreas(question, [release], { question: true }, now)).toEqual([]);
  expect(matchLocalAreas("Melbourne LGA VIC", [release], { question: true }, now)).toHaveLength(1);
  expect(matchLocalAreas("Mildura", [release], { state: "VIC", kind: "suburb" }, now)).toEqual([]);
});
it("uses the requested prior quarter and preserves unavailable latest values", () => {
  const [match] = matchLocalAreas("Queenscliffe", [release], { state: "VIC", kind: "LGA" }, now);
  const missing = localFactEvidence(
    match!,
    "What was the median weekly rent for 3 bedroom houses in September 2025?"
  );
  expect(missing[0]!.withheldRent).toBe(true);
  expect(missing[0]!.text).toContain("unavailable in source; reason not stated");
  expect(missing[0]!.localRent!.observations[0]!.value).toBeNull();
  const earlier = localFactEvidence(match!, "3 bedroom houses in September 2024");
  expect(earlier[0]!.date).toBe("2024-09-30");
  expect(localDatasetIsOlder(release, now)).toBe(true);
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readLocalDataset).mockResolvedValue(null);
});
it("imports once under the durable lease without recording successful publisher access", async () => {
  expect(isCollectionJob(REVIEWED_VIC_JOB)).toBe(true);
  expect(await reviewedVicReleasePending()).toBe(true);
  await importReviewedVicRelease();
  expect(writeLocalDataset).toHaveBeenCalledWith(release, { onlyIfMissing: true });
  expect(markLocalDataCheck).not.toHaveBeenCalled();
  vi.mocked(readLocalDataset).mockResolvedValue({ ...release, period: "2026-06-30" });
  expect(await reviewedVicReleasePending()).toBe(false);
  await importReviewedVicRelease();
  expect(writeLocalDataset).toHaveBeenCalledTimes(1);
});
it("keeps reviewed writes retryable alongside catalogue-based updates", async () => {
  vi.mocked(writeLocalDataset).mockRejectedValueOnce(new Error("Lease expired"));
  await expect(importReviewedVicRelease()).rejects.toThrow("Lease expired");
  expect(markLocalDataCheck).not.toHaveBeenCalled();
  expect(LOCAL_SOURCE_KEYS).toContain("vic-bond-rents");
});
