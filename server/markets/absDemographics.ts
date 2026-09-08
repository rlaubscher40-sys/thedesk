import {
  DEMOGRAPHIC_FLOW,
  DEMOGRAPHIC_MEASURES,
  DEMOGRAPHIC_REGIONS,
  demographicsDataUrl,
  type DemographicObservation,
  type StateDemographics,
} from "../../shared/stateDemographics";
import { cached } from "../core/cache";
import { csvRows } from "../core/strictCsv";

const BASE_IDENTITY = { DATAFLOW: DEMOGRAPHIC_FLOW, FREQ: "Q", UNIT_MEASURE: "NUM" };
const VALID_STATUS = new Set(["", "p", "r"]);

/** Parse only the pinned state-level population/component series. */
export function parseAbsDemographics(csv: string, retrievedAt: string): StateDemographics {
  if (csv.length > 64_000 || !Number.isFinite(Date.parse(retrievedAt)))
    throw new Error("Invalid demographics response");
  const [header, ...rows] = csvRows(csv.replace(/^\uFEFF/, ""));
  const required = [
    ...Object.keys(BASE_IDENTITY),
    "MEASURE",
    "REGION",
    "UNIT_MULT",
    "TIME_PERIOD",
    "OBS_VALUE",
    "OBS_STATUS",
  ];
  if (
    !header ||
    new Set(header).size !== header.length ||
    required.some((key) => !header.includes(key)) ||
    rows.length > Object.keys(DEMOGRAPHIC_REGIONS).length * 3 * 8
  )
    throw new Error("Unexpected demographics schema");
  const seen = new Set<string>();
  const observations: DemographicObservation[] = [];
  for (const cells of rows) {
    if (cells.length !== header.length) throw new Error("Unexpected demographics row");
    const row = Object.fromEntries(header.map((key, index) => [key, cells[index]!]));
    const measure = DEMOGRAPHIC_MEASURES[row.MEASURE as keyof typeof DEMOGRAPHIC_MEASURES];
    if (
      Object.entries(BASE_IDENTITY).some(([key, value]) => row[key] !== value) ||
      !measure ||
      row.UNIT_MULT !== measure.unitMultiplier ||
      !Object.hasOwn(DEMOGRAPHIC_REGIONS, row.REGION!)
    )
      throw new Error("Unexpected demographics series");
    if (!/^\d{4}-Q[1-4]$/.test(row.TIME_PERIOD!)) throw new Error("Invalid demographics period");
    const state = DEMOGRAPHIC_REGIONS[row.REGION as keyof typeof DEMOGRAPHIC_REGIONS];
    const key = `${state}:${measure.name}:${row.TIME_PERIOD}`;
    if (seen.has(key)) throw new Error("Duplicate demographics observation");
    seen.add(key);
    const numeric = /^-?\d+(?:\.\d+)?$/.test(row.OBS_VALUE!) ? Number(row.OBS_VALUE) : null;
    const multiplier = measure.unitMultiplier === "3" ? 1_000 : 1;
    const people =
      VALID_STATUS.has(row.OBS_STATUS!) && numeric !== null ? numeric * multiplier : null;
    observations.push({
      state,
      measure: measure.name,
      period: row.TIME_PERIOD!,
      people: people !== null && Number.isSafeInteger(people) ? people : null,
      status: row.OBS_STATUS!,
    });
  }
  return { status: observations.length ? "available" : "unavailable", retrievedAt, observations };
}

export async function getStateDemographics(): Promise<StateDemographics> {
  return cached("abs:demographics:attempt", 60_000, async () => {
    try {
      return await cached("abs:demographics:data", 3_600_000, async () => {
        const retrievedAt = new Date().toISOString();
        const response = await fetch(demographicsDataUrl(retrievedAt), {
          headers: { Accept: "text/csv" },
          signal: AbortSignal.timeout(8_000),
        });
        if (
          !response.ok ||
          !["text/csv", "application/vnd.sdmx.data+csv"].includes(
            (response.headers.get("content-type") ?? "").split(";")[0]!.trim()
          ) ||
          Number(response.headers.get("content-length")) > 64_000
        )
          throw new Error("Demographics unavailable");
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Empty demographics response");
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 64_000) throw new Error("Oversized demographics response");
            chunks.push(value);
          }
        } finally {
          await reader.cancel();
        }
        const data = parseAbsDemographics(Buffer.concat(chunks).toString("utf8"), retrievedAt);
        if (data.status !== "available") throw new Error("No demographics observations");
        return data;
      });
    } catch {
      return { status: "unavailable", retrievedAt: null, observations: [] };
    }
  });
}
