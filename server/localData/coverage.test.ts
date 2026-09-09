import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../db/localData", () => ({readLocalDataset:vi.fn(),readLocalDataHealth:vi.fn()}));
import { readLocalDataset, readLocalDataHealth } from "../db/localData";
import { getLocalCoverage } from "./read";
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readLocalDataset).mockResolvedValue(null);
  vi.mocked(readLocalDataHealth).mockResolvedValue([]);
});
it("reports an absent snapshot as not collected, not unpublished", async () => {
  expect((await getLocalCoverage())[0]).toMatchObject({collectionState:"Not collected",observationCoverage:{published:0,notPublished:0,insufficientSample:0}});
});
it("does not hide a failed health read behind healthy labels", async () => {
  vi.mocked(readLocalDataHealth).mockRejectedValue(new Error("Database unavailable"));
  await expect(getLocalCoverage()).rejects.toThrow("Database unavailable");
});
it("does not hide a failed snapshot read behind a missing-data label", async () => {
  vi.mocked(readLocalDataset).mockRejectedValueOnce(new Error("Snapshot read failed"));
  await expect(getLocalCoverage()).rejects.toThrow("Snapshot read failed");
});
