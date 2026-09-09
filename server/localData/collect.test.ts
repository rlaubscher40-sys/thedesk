import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../db/localData", () => ({
  readLocalDataset: vi.fn(),
  writeLocalDataset: vi.fn(),
  markLocalDataCheck: vi.fn(),
  readLocalDataHealth: vi.fn(),
}));
vi.mock("../db/collectionRuns", () => ({ collectionSignal: () => undefined }));
vi.mock("../db/localTransfers", () => ({recordLocalTransfer:vi.fn()}));
vi.mock("./fetch", () => ({
  fetchSource: vi.fn(),
  fetchSourceResponse: vi.fn(),
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
import { recordLocalTransfer } from "../db/localTransfers";
import { collectLocalData, reusableDownloadCache, LOCAL_PARSER_VERSION } from "./collect";
import { LocalSourceAccessPaused } from "./access";
import { fetchSource, fetchSourceResponse } from "./fetch";
import type { LocalDataset } from "../../shared/localData";
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
  vi.mocked(recordLocalTransfer).mockResolvedValue(undefined);
  vi.mocked(readLocalDataset).mockResolvedValue(null);
  vi.mocked(fetchSource).mockResolvedValue(Buffer.from("file"));
  vi.mocked(fetchSourceResponse).mockResolvedValue({
    status: "downloaded",
    bytes: Buffer.from("file"),
    finalUrl: "https://www.nsw.gov.au/file.xlsx",
  });
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
  expect(recordLocalTransfer).not.toHaveBeenCalled();
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

it("records estimated avoided body bytes only when a previous file size is known", async () => {
  const previous = cachedDataset();
  previous.downloadCache!.bodyBytes = 1234;
  vi.mocked(readLocalDataset).mockResolvedValue(previous);
  vi.mocked(fetchSourceResponse).mockResolvedValue({status:"unchanged"});
  await collectLocalData("nsw-bond-rents");
  expect(recordLocalTransfer).toHaveBeenCalledWith("nsw-bond-rents",{status:"unchanged",previousBodyBytes:1234});
});

it("does not block valid collection when optional measurement storage is unavailable", async () => {
  vi.mocked(recordLocalTransfer).mockRejectedValue(new Error("Measurement table unavailable"));
  await collectLocalData("nsw-bond-rents");
  expect(writeLocalDataset).toHaveBeenCalledTimes(1);
  expect(markLocalDataCheck).toHaveBeenCalledWith("nsw-bond-rents",null);
});
it("retains the last good snapshot on a schema failure and reports failure", async () => {
  vi.mocked(parseNswBonds).mockImplementation(() => {
    throw new Error("Schema changed");
  });
  await expect(collectLocalData("nsw-bond-rents")).rejects.toThrow("Schema changed");
  expect(writeLocalDataset).not.toHaveBeenCalled();
  expect(recordLocalTransfer).toHaveBeenCalledWith("nsw-bond-rents", {status:"downloaded",bodyBytes:4});
  expect(markLocalDataCheck).toHaveBeenCalledWith("nsw-bond-rents", "Schema changed");
});
it("does not report success when storage fails", async () => {
  vi.mocked(writeLocalDataset).mockRejectedValue(new Error("Storage unavailable"));
  await expect(collectLocalData("nsw-bond-rents")).rejects.toThrow("Storage unavailable");
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
  await expect(collectLocalData("sa-bond-rents")).rejects.toBeInstanceOf(LocalSourceAccessPaused);
  expect(fetchSource).not.toHaveBeenCalled();
  expect(markLocalDataCheck).not.toHaveBeenCalled();
  expect(writeLocalDataset).not.toHaveBeenCalled();
});
it("persists a first discovery denial with stage context and no success", async () => {
  vi.mocked(fetchSource).mockRejectedValueOnce(new Error("Publisher HTTP 403 (www.nsw.gov.au)"));
  await expect(collectLocalData("nsw-bond-rents")).rejects.toBeInstanceOf(LocalSourceAccessPaused);
  expect(markLocalDataCheck).toHaveBeenCalledWith(
    "nsw-bond-rents",
    "Source discovery: Publisher HTTP 403 (www.nsw.gov.au)"
  );
  expect(writeLocalDataset).not.toHaveBeenCalled();
});
it("distinguishes file access denial from catalogue discovery", async () => {
  vi.mocked(fetchSourceResponse).mockRejectedValueOnce(new Error("Publisher HTTP 401"));
  await expect(collectLocalData("nsw-bond-rents")).rejects.toBeInstanceOf(LocalSourceAccessPaused);
  expect(markLocalDataCheck).toHaveBeenCalledWith(
    "nsw-bond-rents",
    "Data download: Publisher HTTP 401"
  );
});

const cachedDataset = (): LocalDataset => ({
  sourceKey: "nsw-bond-rents",
  period: "2026-08-01",
  resourceUrl: "https://www.nsw.gov.au/file.xlsx",
  fingerprint: createHash("sha256")
    .update("local-data-v1\nhttps://www.nsw.gov.au/file.xlsx")
    .update("file")
    .digest("hex"),
  retrievedAt: "2026-09-01T00:00:00Z",
  areas: [],
  excludedRows: 0,
  downloadCache: {
    resourceUrl: "https://www.nsw.gov.au/file.xlsx",
    finalUrl: "https://www.nsw.gov.au/file.xlsx",
    parserVersion: LOCAL_PARSER_VERSION,
    downloadedAt: new Date().toISOString(),
    etag: '"v1"',
  },
});
it("skips body parsing and snapshot writes on a valid unchanged response", async () => {
  const previous = cachedDataset();
  vi.mocked(readLocalDataset).mockResolvedValue(previous);
  vi.mocked(fetchSourceResponse).mockResolvedValue({ status: "unchanged" });
  await collectLocalData("nsw-bond-rents");
  expect(fetchSourceResponse).toHaveBeenCalledWith(
    previous.resourceUrl,
    "nsw-bond-rents",
    10_000_000,
    undefined,
    previous.downloadCache
  );
  expect(readWorkbook).not.toHaveBeenCalled();
  expect(writeLocalDataset).not.toHaveBeenCalled();
  expect(markLocalDataCheck).toHaveBeenCalledWith("nsw-bond-rents", null);
});
it("does not trust an unchanged result without the cached snapshot", async () => {
  vi.mocked(fetchSourceResponse).mockResolvedValue({ status: "unchanged" });
  await expect(collectLocalData("nsw-bond-rents")).rejects.toThrow("no reusable snapshot");
  expect(markLocalDataCheck).not.toHaveBeenCalledWith("nsw-bond-rents", null);
});
it("refreshes only validators when a full response has identical content", async () => {
  const previous = cachedDataset();
  vi.mocked(readLocalDataset).mockResolvedValue(previous);
  vi.mocked(fetchSourceResponse).mockResolvedValue({
    status: "downloaded",
    bytes: Buffer.from("file"),
    finalUrl: previous.resourceUrl,
    etag: '"v2"',
  });
  await collectLocalData("nsw-bond-rents");
  expect(readWorkbook).not.toHaveBeenCalled();
  expect(writeLocalDataset).toHaveBeenCalledWith(
    expect.objectContaining({
      fingerprint: previous.fingerprint,
      retrievedAt: previous.retrievedAt,
      period: previous.period,
      downloadCache: expect.objectContaining({ etag: '"v2"' }),
    })
  );
});
it("parses a revised same-URL release and stores its validators only after success", async () => {
  const previous = cachedDataset();
  vi.mocked(readLocalDataset).mockResolvedValue(previous);
  vi.mocked(fetchSourceResponse).mockResolvedValue({
    status: "downloaded",
    bytes: Buffer.from("revision"),
    finalUrl: previous.resourceUrl,
    etag: '"v2"',
  });
  await collectLocalData("nsw-bond-rents");
  expect(readWorkbook).toHaveBeenCalledTimes(1);
  expect(writeLocalDataset).toHaveBeenCalledWith(
    expect.objectContaining({
      downloadCache: expect.objectContaining({ etag: '"v2"' }),
      fingerprint: expect.not.stringMatching(previous.fingerprint),
    })
  );
});
it("forces full downloads for changed URLs, parser versions and weekly revalidation", () => {
  const previous = cachedDataset();
  const now = new Date();
  expect(reusableDownloadCache(previous, previous.resourceUrl, now)).toBeDefined();
  expect(
    reusableDownloadCache(previous, `${previous.resourceUrl}?revision=2`, now)
  ).toBeUndefined();
  expect(
    reusableDownloadCache(
      { ...previous, downloadCache: { ...previous.downloadCache!, parserVersion: "old" } },
      previous.resourceUrl,
      now
    )
  ).toBeUndefined();
  for (const downloadedAt of [
    "bad",
    new Date(now.getTime() + 60_000).toISOString(),
    new Date(now.getTime() - 7 * 24 * 60 * 60_000).toISOString(),
  ])
    expect(
      reusableDownloadCache(
        { ...previous, downloadCache: { ...previous.downloadCache!, downloadedAt } },
        previous.resourceUrl,
        now
      )
    ).toBeUndefined();
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
