import { createHash } from "node:crypto";
import { readWorkbook } from "./workbook";
import { parseVicRents } from "./vicRents";
import { vicResource } from "./vicResources";
import { readLocalDataset, writeLocalDataset } from "../db/localData";
import { getDb } from "../db/client";
import type { LocalDataset } from "../../shared/localData";

let busy = false;
export async function uploadVicWorkbook(input: { base64: string; resourceUrl: string; commit: boolean; expectedHash?: string }) {
  if (busy) throw new Error("Another workbook is being checked; try again shortly");
  busy = true;
  try {
    if (!getDb()) throw new Error("Workbook imports require a live database");
    if (!input.base64 || input.base64.length > 2_800_000)
      throw new Error("Choose an Excel workbook no larger than 2 MB");
    const bytes = Buffer.from(input.base64, "base64");
    if (bytes.toString("base64") !== input.base64) throw new Error("Invalid workbook encoding");
    if (bytes.length > 2_000_000) throw new Error("Choose an Excel workbook no larger than 2 MB");
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (input.commit && input.expectedHash !== hash) throw new Error("Preview this exact workbook before importing");
    const resource = vicResource(input.resourceUrl);
    const parsed = parseVicRents(await readWorkbook(bytes, undefined, "vic-rents"), resource.period);
    const previous = await readLocalDataset("vic-bond-rents");
    if (previous && previous.period > parsed.period) throw new Error("A newer release is already stored");
    const data: LocalDataset = {
      ...parsed, sourceKey: "vic-bond-rents", resourceUrl: resource.url,
      fingerprint: createHash("sha256").update("vic-reviewed-v1\n").update(resource.url).update(bytes).digest("hex"),
      retrievedAt: new Date().toISOString(), provenance: "reviewed-release", acquisition: "user-upload",
    };
    const unchanged = previous?.fingerprint === data.fingerprint;
    if (input.commit && !unchanged) await writeLocalDataset(data);
    const observations = parsed.areas.flatMap(a => a.observations).filter(o => o.period === parsed.period);
    return { hash, period: parsed.period, areas: parsed.areas.length,
      published: observations.filter(o => o.value !== null).length,
      unavailable: observations.filter(o => o.value === null).length,
      unchanged, imported: input.commit, resourceUrl: resource.url };
  } finally { busy = false; }
}
