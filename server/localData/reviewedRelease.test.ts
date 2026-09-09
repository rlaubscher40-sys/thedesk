import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../db/localData", () => ({
  readLocalDataset: vi.fn(),
  writeLocalDataset: vi.fn(),
  markLocalDataCheck: vi.fn(),
}));
import {
  readLocalDataset,
  writeLocalDataset,
  markLocalDataCheck,
} from "../db/localData";
import {
  importReviewedSaRelease,
  reviewedSaReleasePending,
  REVIEWED_SA_JOB,
} from "./reviewedRelease";
import { isCollectionJob } from "../db/collectionRuns";
import { localFactEvidence, matchLocalAreas } from "./read";
import sa from "./releases/sa-2026-06";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readLocalDataset).mockResolvedValue(null);
});
it("imports missing SA evidence without clearing access health or changing its date", async () => {
  expect(isCollectionJob(REVIEWED_SA_JOB)).toBe(true);
  expect(await reviewedSaReleasePending()).toBe(true);
  await importReviewedSaRelease();
  expect(writeLocalDataset).toHaveBeenCalledWith(sa, { onlyIfMissing: true });
  expect(sa.period).toBe("2026-06-30");
  expect(sa.retrievedAt).toBe("2026-09-09T08:26:23.209Z");
  expect(markLocalDataCheck).not.toHaveBeenCalled();
});
it("does not replace any existing snapshot, including a newer source release", async () => {
  vi.mocked(readLocalDataset).mockResolvedValue({
    ...sa,
    period: "2026-09-30",
  });
  expect(await reviewedSaReleasePending()).toBe(false);
  await importReviewedSaRelease();
  expect(writeLocalDataset).not.toHaveBeenCalled();
});
it("propagates failed storage without claiming a successful source check", async () => {
  vi.mocked(writeLocalDataset).mockRejectedValue(new Error("Lease expired"));
  await expect(importReviewedSaRelease()).rejects.toThrow("Lease expired");
  expect(markLocalDataCheck).not.toHaveBeenCalled();
});
it("preserves the reviewed source's geography, suppression and rounded-count threshold", () => {
  expect(sa.areas).toHaveLength(881);
  expect(new Set(sa.areas.map((a) => a.id)).size).toBe(881);
  const published = sa.areas
    .flatMap((a) => a.observations)
    .filter((o) => o.value !== null);
  expect(published).toHaveLength(510);
  expect(sa.areas.every((a) => a.state === "SA")).toBe(true);
  expect(
    published.every(
      (o) => o.sample !== null && o.sample >= 15 && o.period === sa.period,
    ),
  ).toBe(true);
  const area = sa.areas.find((a) => a.id === "sa:postcode:5000")!;
  expect(
    area.observations.find((o) => o.category === "Flat 2 bedrooms"),
  ).toMatchObject({ value: 650, sample: 230 });
  expect(
    area.observations.find((o) => o.category === "Flat 4+ bedrooms"),
  ).toMatchObject({ value: null, status: "insufficient-sample" });
});
it("exposes the reviewed import and original period in Markets and Ask evidence", () => {
  const [match] = matchLocalAreas("5000", [sa], {
    state: "SA",
    kind: "postcode",
  });
  expect(match!.provenance).toBe("reviewed-release");
  const evidence = localFactEvidence(
    match!,
    "2 bedroom flats in postcode 5000 SA",
  )!;
  expect(evidence.text).toContain("650 AUD/week");
  expect(evidence.text).toContain("Reviewed import");
  expect(evidence.date).toBe("2026-06-30");
});
