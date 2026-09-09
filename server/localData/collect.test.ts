import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../db/localData", () => ({
  readLocalDataset: vi.fn(),
  writeLocalDataset: vi.fn(),
  markLocalDataCheck: vi.fn(),
  readLocalDataHealth: vi.fn(),
}));
vi.mock("../db/collectionRuns", () => ({ collectionSignal: () => undefined }));
vi.mock("./fetch", () => ({
  fetchSource: vi.fn(),
  selectResource: () => ({
    url: "https://www.nsw.gov.au/file.xlsx",
    period: "2026-08",
  }),
}));
vi.mock("./workbook", () => ({ readWorkbook: vi.fn() }));
vi.mock("./parsers", () => ({
  parseNswBonds: vi.fn(),
  parseQldBonds: vi.fn(),
  parseLocalPopulation: vi.fn(),
}));
import { createHash } from "node:crypto";
import { collectLocalData } from "./collect";
import { LocalSourceAccessPaused } from "./access";
import { fetchSource } from "./fetch";
import { readWorkbook } from "./workbook";
import { parseNswBonds } from "./parsers";
import {
  readLocalDataset,
  writeLocalDataset,
  markLocalDataCheck,
  readLocalDataHealth,
} from "../db/localData";
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readLocalDataHealth).mockResolvedValue([]);
  vi.mocked(readLocalDataset).mockResolvedValue(null);
  vi.mocked(fetchSource).mockResolvedValue(Buffer.from("file"));
  vi.mocked(readWorkbook).mockResolvedValue([]);
  vi.mocked(parseNswBonds).mockReturnValue({
    period: "2026-08-01",
    areas: [],
    excludedRows: 0,
  });
});
it("does not download within the persistent success cooldown", async () => {
  vi.mocked(readLocalDataHealth).mockResolvedValue([
    {
      sourceKey: "nsw-bond-rents",
      checkedAt: new Date(),
      lastSuccessAt: new Date(),
      error: null,
    },
  ]);
  await collectLocalData("nsw-bond-rents");
  expect(fetchSource).not.toHaveBeenCalled();
});
it("does not reparse or duplicate an unchanged workbook", async () => {
  const fingerprint = createHash("sha256")
    .update("local-data-v1\n")
    .update("https://www.nsw.gov.au/file.xlsx")
    .update(Buffer.from("file"))
    .digest("hex");
  vi.mocked(readLocalDataset).mockResolvedValue({
    sourceKey: "nsw-bond-rents",
    fingerprint,
    areas: [],
    excludedRows: 0,
    period: "2026-08-01",
    retrievedAt: "2026-09-01T00:00:00Z",
    resourceUrl: "https://www.nsw.gov.au/file.xlsx",
  });
  await collectLocalData("nsw-bond-rents");
  expect(readWorkbook).not.toHaveBeenCalled();
  expect(writeLocalDataset).not.toHaveBeenCalled();
  expect(markLocalDataCheck).toHaveBeenCalledWith("nsw-bond-rents", null);
});
it("retains the last good snapshot on a schema failure and reports failure", async () => {
  vi.mocked(parseNswBonds).mockImplementation(() => {
    throw new Error("Schema changed");
  });
  await expect(collectLocalData("nsw-bond-rents")).rejects.toThrow(
    "Schema changed",
  );
  expect(writeLocalDataset).not.toHaveBeenCalled();
  expect(markLocalDataCheck).toHaveBeenCalledWith(
    "nsw-bond-rents",
    "Schema changed",
  );
});
it("does not report success when storage fails", async () => {
  vi.mocked(writeLocalDataset).mockRejectedValue(
    new Error("Storage unavailable"),
  );
  await expect(collectLocalData("nsw-bond-rents")).rejects.toThrow(
    "Storage unavailable",
  );
  expect(markLocalDataCheck).not.toHaveBeenCalledWith("nsw-bond-rents", null);
});

it("honours a persisted legacy denial without downloading or marking success", async () => {
  vi.mocked(readLocalDataHealth).mockResolvedValue([
    {
      sourceKey: "sa-bond-rents",
      checkedAt: new Date("2026-09-09"),
      lastSuccessAt: null,
      error: "Publisher HTTP 403",
    },
  ]);
  await expect(collectLocalData("sa-bond-rents")).rejects.toBeInstanceOf(
    LocalSourceAccessPaused,
  );
  expect(fetchSource).not.toHaveBeenCalled();
  expect(markLocalDataCheck).not.toHaveBeenCalled();
  expect(writeLocalDataset).not.toHaveBeenCalled();
});
it("persists a first discovery denial with stage context and no success", async () => {
  vi.mocked(fetchSource).mockRejectedValueOnce(
    new Error("Publisher HTTP 403 (www.nsw.gov.au)"),
  );
  await expect(collectLocalData("nsw-bond-rents")).rejects.toBeInstanceOf(
    LocalSourceAccessPaused,
  );
  expect(markLocalDataCheck).toHaveBeenCalledWith(
    "nsw-bond-rents",
    "Source discovery: Publisher HTTP 403 (www.nsw.gov.au)",
  );
  expect(writeLocalDataset).not.toHaveBeenCalled();
});
it("distinguishes file access denial from catalogue discovery", async () => {
  vi.mocked(fetchSource)
    .mockResolvedValueOnce(Buffer.from("page"))
    .mockRejectedValueOnce(new Error("Publisher HTTP 401"));
  await expect(collectLocalData("nsw-bond-rents")).rejects.toBeInstanceOf(
    LocalSourceAccessPaused,
  );
  expect(markLocalDataCheck).toHaveBeenCalledWith(
    "nsw-bond-rents",
    "Data download: Publisher HTTP 401",
  );
});
it("does not pause or hide ordinary transient download failures", async () => {
  vi.mocked(fetchSource).mockRejectedValueOnce(new Error("Publisher HTTP 500"));
  try {
    await collectLocalData("nsw-bond-rents");
    throw new Error("Expected failure");
  } catch (e) {
    expect(e).not.toBeInstanceOf(LocalSourceAccessPaused);
    expect((e as Error).message).toContain("Publisher HTTP 500");
  }
});
