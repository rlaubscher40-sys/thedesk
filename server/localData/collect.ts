import { createHash } from "node:crypto";
import {
  LOCAL_SOURCES,
  type LocalDataset,
  type LocalSourceKey,
} from "../../shared/localData";
import {
  readLocalDataset,
  writeLocalDataset,
  markLocalDataCheck,
  readLocalDataHealth,
} from "../db/localData";
import { collectionSignal } from "../db/collectionRuns";
import { fetchSource, selectResource } from "./fetch";
import { readWorkbook } from "./workbook";
import { parseLocalPopulation, parseNswBonds, parseQldBonds } from "./parsers";
import { discoverRentResource } from "./rentResources";
import { parseSaBonds, parseTasBonds } from "./stateRents";
import { parseWaArchive } from "./waArchive";

export async function collectLocalData(source: LocalSourceKey): Promise<void> {
  const signal = collectionSignal();
  // Success cooldown is persistent across app restarts and manual/scheduled calls.
  const health = (await readLocalDataHealth()).find(
    (row) => row.sourceKey === source,
  );
  if (
    health?.lastSuccessAt &&
    Date.now() - health.lastSuccessAt.getTime() < 12 * 60 * 60_000
  )
    return;
  try {
    const now = new Date();
    const resource =
      source === "sa-bond-rents" ||
      source === "wa-bond-rents" ||
      source === "tas-bond-rents"
        ? await discoverRentResource(source, now, signal)
        : selectResource(
            source,
            (
              await fetchSource(
                LOCAL_SOURCES[source].url,
                source,
                2_000_000,
                signal,
              )
            ).toString("utf8"),
            now,
          );
    const bytes = await fetchSource(resource.url, source, 10_000_000, signal);
    const fingerprint = createHash("sha256")
      .update("local-data-v1\n")
      .update(resource.url)
      .update(bytes)
      .digest("hex");
    const previous = await readLocalDataset(source);
    if (previous?.fingerprint !== fingerprint) {
      const sheets =
        source === "wa-bond-rents" ? [] : await readWorkbook(bytes, signal);
      const parsed =
        source === "abs-sa2-population"
          ? parseLocalPopulation(sheets, Number(resource.period.slice(0, 4)))
          : source === "nsw-bond-rents"
            ? parseNswBonds(sheets, resource.period)
            : source === "qld-bond-rents"
              ? parseQldBonds(sheets)
              : source === "sa-bond-rents"
                ? parseSaBonds(sheets, resource.period)
                : source === "tas-bond-rents"
                  ? parseTasBonds(sheets, resource.period)
                  : await parseWaArchive(bytes, resource.period, signal);
      if (parsed.period >= now.toISOString().slice(0, 10))
        throw new Error("Source reporting period is not complete");
      const data: LocalDataset = {
        ...parsed,
        sourceKey: source,
        resourceUrl: resource.url,
        fingerprint,
        retrievedAt: now.toISOString(),
      };
      signal?.throwIfAborted();
      await writeLocalDataset(data);
    }
    signal?.throwIfAborted();
    await markLocalDataCheck(source, null);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.slice(0, 240)
        : "Local collection failed";
    await markLocalDataCheck(source, message);
    throw new Error(`${LOCAL_SOURCES[source].label}: ${message}`);
  }
}
