import fs from "node:fs/promises";
import { documentaryQueueStatus } from "./lib/documentaryQueueStatus";

const ledger = JSON.parse(
  await fs.readFile(new URL("../docs/documentary-editorial-queue.json", import.meta.url), "utf8")
);
const status = documentaryQueueStatus(ledger, new Date());
console.log(JSON.stringify(status, null, 2));
// Held exports are a valid checkpoint, not a failed execution. Drift is a failure.
if (status.episodes.some((item) => !item.currentInputMatchesRecoveredExport)) process.exitCode = 1;
