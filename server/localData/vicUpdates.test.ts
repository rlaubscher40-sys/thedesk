import { beforeEach, expect, it, vi } from "vitest";
import catalogue from "./fixtures/vic-catalogue.json";
import fixture from "./fixtures/vic-lga-sep2025.json";
import release from "./releases/vic-2025-09";
import { VIC_CATALOGUE, selectVicResource, vicResource } from "./vicResources";
import type { Sheet } from "./parsers";
vi.mock("../db/client", () => ({ getDb: () => ({}) }));
vi.mock("../db/localData", () => ({ readLocalDataset: vi.fn(), writeLocalDataset: vi.fn(), markLocalDataCheck: vi.fn(), readLocalDataHealth: vi.fn() }));
vi.mock("../db/collectionRuns", () => ({ collectionSignal: () => undefined }));
vi.mock("../db/localTransfers", () => ({ recordLocalTransfer: vi.fn() }));
vi.mock("./workbook", () => ({ readWorkbook: vi.fn() }));
vi.mock("./fetch", async importOriginal => ({ ...await importOriginal<typeof import("./fetch")>(), fetchSource: vi.fn(), fetchSourceResponse: vi.fn() }));
import { readLocalDataset, writeLocalDataset, markLocalDataCheck, readLocalDataHealth } from "../db/localData";
import { readWorkbook } from "./workbook";
import { fetchSource, fetchSourceResponse, sourceHostAllowed } from "./fetch";
import { collectLocalData } from "./collect";
import { uploadVicWorkbook } from "./vicUpload";
const now = new Date("2026-09-10T00:00:00Z");
const base64 = Buffer.from("workbook bytes supplied to mocked bounded reader").toString("base64");
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readLocalDataset).mockResolvedValue(release);
  vi.mocked(readLocalDataHealth).mockResolvedValue([]);
  vi.mocked(fetchSource).mockResolvedValue(Buffer.from(JSON.stringify(catalogue)));
  vi.mocked(readWorkbook).mockResolvedValue(structuredClone(fixture) as Sheet[]);
});
it("discovers the actual catalogue's latest completed quarterly LGA resource", () => {
  expect(selectVicResource(JSON.stringify(catalogue), now)).toEqual({url: release.resourceUrl, period: release.period});
});
it.each([
  "https://evil.example/quarterly-median-rents-local-government-area-september-quarter-2025-excel",
  "https://www.dffh.vic.gov.au@evil.example/file.xlsx",
  "https://www.dffh.vic.gov.au/moving-annual-rent-suburb-september-quarter-2025-excel",
  release.resourceUrl + "?redirect=https://evil.example",
  release.resourceUrl.replace("2025", "2027"),
])("rejects wrong source, geography or incomplete period: %s", url => {
  expect(() => vicResource(url, now)).toThrow();
});
it("does not broaden publisher allowlists for arbitrary catalogue URLs", () => {
  expect(sourceHostAllowed(new URL(VIC_CATALOGUE), "vic-bond-rents")).toBe(true);
  expect(sourceHostAllowed(new URL(VIC_CATALOGUE + "&other=1"), "vic-bond-rents")).toBe(false);
  expect(sourceHostAllowed(new URL(VIC_CATALOGUE), "nsw-bond-rents")).toBe(false);
});
it("fails closed on catalogue licence or identity changes", () => {
  const changed = structuredClone(catalogue);
  changed.result.license_id = "all-rights-reserved";
  expect(() => selectVicResource(JSON.stringify(changed), now)).toThrow("licence");
  changed.result.license_id = "cc-by"; changed.result.name = "suburb-rents";
  expect(() => selectVicResource(JSON.stringify(changed), now)).toThrow("identity");
});
it("checks the catalogue without downloading or rewriting an already stored quarter", async () => {
  await collectLocalData("vic-bond-rents");
  expect(fetchSource).toHaveBeenCalledWith(VIC_CATALOGUE, "vic-bond-rents", 2_000_000, undefined);
  expect(fetchSourceResponse).not.toHaveBeenCalled();
  expect(readWorkbook).not.toHaveBeenCalled();
  expect(writeLocalDataset).not.toHaveBeenCalled();
  expect(markLocalDataCheck).toHaveBeenCalledWith("vic-bond-rents", null);
});
it("downloads and validates a newer listed release using the full-width VIC profile", async () => {
  vi.mocked(readLocalDataset).mockResolvedValue({...release, period:"2025-06-30"});
  vi.mocked(fetchSourceResponse).mockResolvedValue({status:"downloaded", bytes:Buffer.from("xls"), finalUrl:release.resourceUrl});
  await collectLocalData("vic-bond-rents");
  expect(readWorkbook).toHaveBeenCalledWith(Buffer.from("xls"), undefined, "vic-rents");
  expect(writeLocalDataset).toHaveBeenCalledWith(expect.objectContaining({period:release.period, areas:release.areas}));
});
it("preserves the snapshot and reports a failed new-release download", async () => {
  vi.mocked(readLocalDataset).mockResolvedValue({...release, period:"2025-06-30"});
  vi.mocked(fetchSourceResponse).mockRejectedValue(new Error("Publisher HTTP 502"));
  await expect(collectLocalData("vic-bond-rents")).rejects.toThrow("502");
  expect(writeLocalDataset).not.toHaveBeenCalled();
  expect(markLocalDataCheck).toHaveBeenCalledWith("vic-bond-rents", expect.stringContaining("Data download"));
});
it("previews then imports the exact validated upload without faking publisher health", async () => {
  const input = {base64, resourceUrl:release.resourceUrl, commit:false};
  const preview = await uploadVicWorkbook(input);
  expect(preview).toMatchObject({areas:79, period:"2025-09-30", published:457, unavailable:96, imported:false});
  expect(writeLocalDataset).not.toHaveBeenCalled();
  await uploadVicWorkbook({...input, commit:true, expectedHash:preview.hash});
  expect(writeLocalDataset).toHaveBeenCalledWith(expect.objectContaining({acquisition:"user-upload", provenance:"reviewed-release", period:release.period}));
  expect(markLocalDataCheck).not.toHaveBeenCalled();
});
it("rejects a changed file between preview and commit", async () => {
  await expect(uploadVicWorkbook({base64,resourceUrl:release.resourceUrl,commit:true,expectedHash:"0".repeat(64)})).rejects.toThrow("Preview");
  expect(readWorkbook).not.toHaveBeenCalled();
});
it("rejects oversized or noncanonical file encoding before parsing", async () => {
  for (const value of ["%%%", "a".repeat(2_800_004), "YQ"]) {
    await expect(uploadVicWorkbook({base64:value,resourceUrl:release.resourceUrl,commit:false})).rejects.toThrow();
  }
  expect(readWorkbook).not.toHaveBeenCalled();
});
it("rejects an older upload and propagates storage errors", async () => {
  vi.mocked(readLocalDataset).mockResolvedValue({...release, period:"2025-12-31"});
  const input = {base64, resourceUrl:release.resourceUrl, commit:false};
  await expect(uploadVicWorkbook(input)).rejects.toThrow("newer release");
  vi.mocked(readLocalDataset).mockResolvedValue(release);
  const preview = await uploadVicWorkbook(input);
  vi.mocked(writeLocalDataset).mockRejectedValue(new Error("Database unavailable"));
  await expect(uploadVicWorkbook({...input, commit:true, expectedHash:preview.hash})).rejects.toThrow("Database unavailable");
});
