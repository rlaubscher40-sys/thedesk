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
