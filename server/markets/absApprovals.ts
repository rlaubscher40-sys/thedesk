import {
  APPROVAL_FLOW,
  APPROVAL_REGIONS,
  approvalsDataUrl,
  type ApprovalObservation,
  type CityApprovals,
} from "../../shared/cityApprovals";
import { cached } from "../core/cache";
import { csvRows } from "../core/strictCsv";

/** Codes verified against the live ABS BA_GCCSA structure and codelists.
 * Dwelling units; all value bands, sectors, work and building types;
 * original monthly counts at capital-city statistical areas (ACT territory for Canberra). */
const IDENTITY = {
  DATAFLOW: APPROVAL_FLOW,
  MEASURE: "1",
  VALUE: "1",
  SECTOR: "9",
  WORK_TYPE: "TOT",
  BUILDING_TYPE: "TOT",
  TSEST: "10",
  FREQ: "M",
  UNIT_MEASURE: "NUM",
  UNIT_MULT: "0",
};
export function parseAbsApprovals(csv: string, retrievedAt: string): CityApprovals {
  if (csv.length > 64_000 || !Number.isFinite(Date.parse(retrievedAt)))
    throw new Error("Invalid approvals response");
  const [header, ...rows] = csvRows(csv.replace(/^\uFEFF/, ""));
  const required = [...Object.keys(IDENTITY), "REGION", "TIME_PERIOD", "OBS_VALUE", "OBS_STATUS"];
  if (
    !header ||
    new Set(header).size !== header.length ||
    required.some((key) => !header.includes(key)) ||
    rows.length > Object.keys(APPROVAL_REGIONS).length * 16
  )
    throw new Error("Unexpected approvals schema");
  const seen = new Set<string>();
  const observations: ApprovalObservation[] = [];
  for (const cells of rows) {
    if (cells.length !== header.length) throw new Error("Unexpected approvals row");
    const row = Object.fromEntries(header.map((key, index) => [key, cells[index]!]));
    if (
      Object.entries(IDENTITY).some(([key, value]) => row[key] !== value) ||
      !Object.hasOwn(APPROVAL_REGIONS, row.REGION!)
    )
      throw new Error("Unexpected approvals series");
    const period = row.TIME_PERIOD!;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period) || period >= retrievedAt.slice(0, 7))
      throw new Error("Invalid approvals period");
    const city = APPROVAL_REGIONS[row.REGION as keyof typeof APPROVAL_REGIONS];
    const key = `${city}:${period}`;
    if (seen.has(key)) throw new Error("Duplicate approvals observation");
    seen.add(key);
    const valid = ["", "p", "r"].includes(row.OBS_STATUS!) && /^\d+$/.test(row.OBS_VALUE!);
    const count = valid ? Number(row.OBS_VALUE) : null;
    // Retain gaps so the annual read cannot quietly shift to an older year.
    observations.push({
      city,
      period,
      dwellings: count !== null && Number.isSafeInteger(count) ? count : null,
      status: row.OBS_STATUS!,
    });
  }
  return { status: observations.length ? "available" : "unavailable", retrievedAt, observations };
}

export async function getCityApprovals(): Promise<CityApprovals> {
  return cached("abs:approvals:attempt", 60_000, async () => {
    try {
      return await cached("abs:approvals:data", 3_600_000, async () => {
        const retrievedAt = new Date().toISOString();
        const response = await fetch(approvalsDataUrl(retrievedAt), {
          headers: { Accept: "text/csv" },
          signal: AbortSignal.timeout(30_000),
        });
        if (
          !response.ok ||
          !["text/csv", "application/vnd.sdmx.data+csv"].includes(
            (response.headers.get("content-type") ?? "").split(";")[0]!.trim()
          ) ||
          Number(response.headers.get("content-length")) > 64_000
        )
          throw new Error("Approvals unavailable");
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Empty approvals response");
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 64_000) throw new Error("Oversized approvals response");
            chunks.push(value);
          }
        } finally {
          await reader.cancel();
        }
        const data = parseAbsApprovals(Buffer.concat(chunks).toString("utf8"), retrievedAt);
        if (data.status !== "available") throw new Error("No approvals observations");
        return data;
      });
    } catch (error) {
      console.warn("[metrics] ABS capital approvals unavailable:", (error as Error).message);
      return { status: "unavailable", retrievedAt: null, observations: [] };
    }
  });
}
