import { createHash } from "node:crypto";
import { LOCAL_SOURCES, type LocalDataset, type LocalSourceKey } from "../../shared/localData";
import {
  readLocalDataset,
  writeLocalDataset,
  markLocalDataCheck,
  readLocalDataHealth,
} from "../db/localData";
import { collectionSignal } from "../db/collectionRuns";
import { fetchSource, fetchSourceResponse, selectResource } from "./fetch";
import { readWorkbook } from "./workbook";
import { parseLocalPopulation, parseNswBonds, parseQldBonds } from "./parsers";
import { discoverRentResource } from "./rentResources";
import { parseSaBonds, parseTasBonds } from "./stateRents";
import { parseWaArchive } from "./waArchive";
import { localSourceAccessDenied } from "../../shared/localSourceAccess";
import { LocalSourceAccessPaused } from "./access";
import { recordLocalTransfer, type LocalTransfer } from "../db/localTransfers";

export const LOCAL_PARSER_VERSION = "local-data-v1";
const FULL_DOWNLOAD_INTERVAL_MS = 7 * 24 * 60 * 60_000;

export function reusableDownloadCache(
  previous: LocalDataset | null,
  resourceUrl: string,
  now: Date
) {
  const cache = previous?.downloadCache;
  const age = now.getTime() - Date.parse(cache?.downloadedAt ?? "");
  return previous?.resourceUrl === resourceUrl &&
    cache?.resourceUrl === resourceUrl &&
    cache.parserVersion === LOCAL_PARSER_VERSION &&
    age >= 0 &&
    age < FULL_DOWNLOAD_INTERVAL_MS &&
    (cache.etag || cache.lastModified)
    ? cache
    : undefined;
}

export async function collectLocalData(source: LocalSourceKey): Promise<void> {
  const signal = collectionSignal();
  const measure = async (transfer: LocalTransfer) => {
    try { await recordLocalTransfer(source, transfer); }
    catch { signal?.throwIfAborted(); console.info("[local-data] transfer measurement unavailable", { source }); }
  };
  // Success cooldown is persistent across app restarts and manual/scheduled calls.
  const health = (await readLocalDataHealth()).find((row) => row.sourceKey === source);
  if (localSourceAccessDenied(health?.error))
    throw new LocalSourceAccessPaused(
      `${LOCAL_SOURCES[source].label}: access review required; ${health!.error}`
    );
  if (health?.lastSuccessAt && Date.now() - health.lastSuccessAt.getTime() < 12 * 60 * 60_000)
    return;
  let stage = "Source discovery";
  try {
    const now = new Date();
    const resource =
      source === "sa-bond-rents" || source === "wa-bond-rents" || source === "tas-bond-rents"
        ? await discoverRentResource(source, now, signal)
        : selectResource(
            source,
            (await fetchSource(LOCAL_SOURCES[source].url, source, 2_000_000, signal)).toString(
              "utf8"
            ),
            now
          );
    stage = "Data download";
    const previous = await readLocalDataset(source);
    const cached = reusableDownloadCache(previous, resource.url, now);
    const downloaded = await fetchSourceResponse(resource.url, source, 10_000_000, signal, cached);
    if (downloaded.status === "unchanged") {
      if (!cached) throw new Error("Unchanged response has no reusable snapshot");
      await measure({status:"unchanged", previousBodyBytes:cached.bodyBytes});
      signal?.throwIfAborted();
      await markLocalDataCheck(source, null);
      return;
    }
    const { bytes, finalUrl, etag, lastModified } = downloaded;
    await measure({status:"downloaded",bodyBytes:bytes.length});
    const downloadCache =
      etag || lastModified
        ? {
            resourceUrl: resource.url,
            finalUrl,
            etag,
            lastModified,
            parserVersion: LOCAL_PARSER_VERSION,
            downloadedAt: now.toISOString(),
            bodyBytes: bytes.length,
          }
        : undefined;
    stage = "Parsing or storage";
    const fingerprint = createHash("sha256")
      .update(`${LOCAL_PARSER_VERSION}\n`)
      .update(resource.url)
      .update(bytes)
      .digest("hex");
    if (previous?.fingerprint !== fingerprint) {
      const sheets = source === "wa-bond-rents" ? [] : await readWorkbook(bytes, signal);
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
        downloadCache,
      };
      signal?.throwIfAborted();
      await writeLocalDataset(data);
    } else if (downloadCache || previous.downloadCache) {
      // Refresh only download metadata. Keep the original observation/retrieval dates.
      await writeLocalDataset({ ...previous, downloadCache });
    }
    signal?.throwIfAborted();
    await markLocalDataCheck(source, null);
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 240) : "Local collection failed";
    const denied = localSourceAccessDenied(detail);
    const message = (stage === "Parsing or storage" ? detail : `${stage}: ${detail}`).slice(0, 240);
    await markLocalDataCheck(source, message);
    if (denied) throw new LocalSourceAccessPaused(`${LOCAL_SOURCES[source].label}: ${message}`);
    throw new Error(`${LOCAL_SOURCES[source].label}: ${message}`);
  }
}
