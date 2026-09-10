/** Read-only source probe: no DB writes, LLM calls or publication. */
import { AUTOMATIC_LOCAL_SOURCE_KEYS, LOCAL_SOURCES } from "../../shared/localData";
import { fetchSource, selectResource } from "../../server/localData/fetch";
import { readWorkbook } from "../../server/localData/workbook";
import { discoverRentResource } from "../../server/localData/rentResources";
import { parseSaBonds, parseTasBonds } from "../../server/localData/stateRents";
import { parseWaArchive } from "../../server/localData/waArchive";
import {
  parseLocalPopulation,
  parseNswBonds,
  parseQldBonds,
} from "../../server/localData/parsers";
for (const source of AUTOMATIC_LOCAL_SOURCE_KEYS) {
  if (process.argv[2] && source !== process.argv[2]) continue;
  try {
    const now = new Date();
    const resource =
      source === "sa-bond-rents" ||
      source === "wa-bond-rents" ||
      source === "tas-bond-rents"
        ? await discoverRentResource(source, now)
        : selectResource(
            source,
            (
              await fetchSource(LOCAL_SOURCES[source].url, source, 2_000_000)
            ).toString("utf8"),
            now,
          );
    const bytes = await fetchSource(resource.url, source, 10_000_000);
    const sheets = source === "wa-bond-rents" ? [] : await readWorkbook(bytes);
    const data =
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
                : await parseWaArchive(bytes, resource.period);
    console.log(
      JSON.stringify({
        source,
        period: data.period,
        areas: data.areas.length,
        states: [...new Set(data.areas.map((a) => a.state))],
        excludedRows: data.excludedRows,
        bytes: bytes.length,
      }),
    );
  } catch (error) {
    console.error(
      source,
      error instanceof Error ? error.message : "Probe failed",
    );
    process.exitCode = 1;
  }
}
