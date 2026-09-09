/** Read-only source probe: no DB writes, LLM calls or publication. */
import { LOCAL_SOURCE_KEYS, LOCAL_SOURCES } from "../../shared/localData";
import { fetchSource, selectResource } from "../../server/localData/fetch";
import { readWorkbook } from "../../server/localData/workbook";
import {
  parseLocalPopulation,
  parseNswBonds,
  parseQldBonds,
} from "../../server/localData/parsers";
for (const source of LOCAL_SOURCE_KEYS) {
  try {
    const now = new Date();
    const page = await fetchSource(
      LOCAL_SOURCES[source].url,
      source,
      2_000_000,
    );
    const resource = selectResource(source, page.toString("utf8"), now);
    const bytes = await fetchSource(resource.url, source, 10_000_000);
    const sheets = await readWorkbook(bytes);
    const data =
      source === "abs-sa2-population"
        ? parseLocalPopulation(sheets, Number(resource.period.slice(0, 4)))
        : source === "nsw-bond-rents"
          ? parseNswBonds(sheets, resource.period)
          : parseQldBonds(sheets);
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
