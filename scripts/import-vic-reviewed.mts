// Read-only source validation + reproducible reviewed aggregate. No database/network/AI.
// node --import tsx scripts/import-vic-reviewed.mts /absolute/path/source.xlsx
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readWorkbook } from "../server/localData/workbook";
import { parseVicRents } from "../server/localData/vicRents";
import type { LocalDataset } from "../shared/localData";
const file = process.argv[2];
if (!file) throw new Error("Provide the reviewed September 2025 Victorian LGA workbook");
const bytes = await readFile(file);
const sourceHash = createHash("sha256").update(bytes).digest("hex");
if (sourceHash !== "b8e96347494f09fea2a2ace55997fd34c9398f8509cb3450d65444aebfaaa837")
  throw new Error(
    "Workbook differs from the reviewed release; review it before changing this import"
  );
const resourceUrl =
  "https://www.dffh.vic.gov.au/quarterly-median-rents-local-government-area-september-quarter-2025-excel";
const sheets = await readWorkbook(bytes, undefined, "vic-rents");
const data: LocalDataset = {
  ...parseVicRents(sheets, "2025-09-30"),
  sourceKey: "vic-bond-rents",
  resourceUrl,
  fingerprint: createHash("sha256")
    .update("vic-reviewed-v1\n")
    .update(resourceUrl)
    .update(bytes)
    .digest("hex"),
  // Time the supplied file became available for review, not publisher retrieval/publication.
  retrievedAt: "2026-09-10T05:51:52.391Z",
  provenance: "reviewed-release",
  acquisition: "user-upload",
};
await mkdir("server/localData/releases", { recursive: true });
await writeFile(
  "server/localData/releases/vic-2025-09.ts",
  `// Homes Victoria September 2025. CC BY 4.0. Supplied publisher workbook.\n// Reproduce with scripts/import-vic-reviewed.mts. See docs/victoria-reviewed-rents.md.\nimport type { LocalDataset } from "../../../shared/localData";\nconst release: LocalDataset = ${JSON.stringify(data)};\nexport default release;\n`
);
await mkdir("server/localData/fixtures", { recursive: true });
// Actual source cells for the five stored quarters, including aggregate rows.
const fixture = sheets.map((s) => ({
  sheet: s.sheet,
  data: s.data.map((row) => [...row.slice(0, 2), ...row.slice(204, 214)]),
}));
await writeFile("server/localData/fixtures/vic-lga-sep2025.json", JSON.stringify(fixture));
const observations = data.areas.flatMap((a) => a.observations);
console.log(
  JSON.stringify({
    sourceHash,
    areas: data.areas.length,
    excludedRows: data.excludedRows,
    observations: observations.length,
    published: observations.filter((o) => o.value !== null).length,
    latestPublished: observations.filter((o) => o.period === data.period && o.value !== null)
      .length,
    payloadBytes: Buffer.byteLength(JSON.stringify(data)),
    examples: data.areas
      .filter((a) => ["Mildura", "Melbourne", "Queenscliffe"].includes(a.name))
      .map((a) => ({ name: a.name, rows: a.observations.filter((o) => o.period === data.period) })),
  })
);
