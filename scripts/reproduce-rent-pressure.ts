/** Usage: node --import tsx scripts/reproduce-rent-pressure.ts /path/to/6401011.xlsx */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { readWorkbook } from "../server/localData/workbook";
import { parseRentWorkbook } from "../server/markets/absRentWorkbook";
import { analyseRentPressure, RENT_PRESSURE_RELEASE as release } from "../shared/rentPressure";
const file = process.argv[2];
if (!file)
  throw new Error(
    "Pass the July 2026 ABS Table 11 workbook downloaded from the source URL in the edition."
  );
const bytes = fs.readFileSync(file);
const hash = createHash("sha256").update(bytes).digest("hex");
if (hash !== release.workbookSha256)
  throw new Error(
    "Workbook differs from the preserved edition. A source revision requires a new dated record."
  );
const parsed = parseRentWorkbook(
  await readWorkbook(bytes, undefined, "abs-cpi"),
  release.sourceUrl,
  release.retrievedAt
);
const result = analyseRentPressure(parsed.observations, release.id);
if (!result) throw new Error("Incomplete or incompatible eight-city input.");
process.stdout.write(JSON.stringify({ workbookSha256: hash, ...result }, null, 2) + "\n");
