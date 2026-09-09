// Build a reviewed aggregate from an already downloaded, openly licensed release.
// Usage: node --import tsx scripts/import-sa-reviewed.mts /absolute/path/sa.xlsx
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readWorkbook } from "../server/localData/workbook";
import { parseSaBonds } from "../server/localData/stateRents";
const file = process.argv[2];
if (!file) throw new Error("Provide the reviewed June 2026 source workbook");
const bytes = await readFile(file);
if (
  createHash("sha256").update(bytes).digest("hex") !==
  "9ed02e20fe38a40827246501f3ee9a26111d8a8cf32b90b2b8ec15e8c7d9a20e"
)
  throw new Error(
    "Workbook differs from the reviewed release; review it before changing this import",
  );
const resourceUrl =
  "https://data.sa.gov.au/data/dataset/8eb97a72-9919-448b-8de6-fc1530b3f7ec/resource/b4aa86f1-7efa-4690-9793-bd36df97ad29/download/private-rental-report-2026-06.xlsx";
const parsed = parseSaBonds(await readWorkbook(bytes), "2026-06");
const data = {
  ...parsed,
  sourceKey: "sa-bond-rents",
  resourceUrl,
  fingerprint: createHash("sha256")
    .update("local-data-v1\n")
    .update(resourceUrl)
    .update(bytes)
    .digest("hex"),
  retrievedAt: (await stat(file)).mtime.toISOString(),
  provenance: "reviewed-release",
};
await mkdir("server/localData/releases", { recursive: true });
await writeFile(
  "server/localData/releases/sa-2026-06.ts",
  `// SA Housing Trust, Private Rental Report, June 2026. CC BY 4.0.\n// See docs/local-source-access.md for provenance and validation.\nimport type { LocalDataset } from "../../../shared/localData";\nconst release: LocalDataset = ${JSON.stringify(data)};\nexport default release;\n`,
);
console.log(
  JSON.stringify({
    sourceHash: createHash("sha256").update(bytes).digest("hex"),
    fingerprint: data.fingerprint,
    retrievedAt: data.retrievedAt,
    areas: data.areas.length,
    published: data.areas
      .flatMap((a) => a.observations)
      .filter((o) => o.value !== null).length,
    examples: data.areas.filter(
      (a) => a.name === "5000" || a.name.toLowerCase() === "adelaide",
    ),
  }),
);
