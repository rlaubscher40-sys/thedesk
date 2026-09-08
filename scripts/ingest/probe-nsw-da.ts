/**
 * Validate an authorised export from the official NSW Online DA API before it
 * is wired into production. This probe performs no network request and writes
 * no application data. Pass a JSON array and the exact council/date filter
 * used to obtain it.
 *
 * pnpm probe:nsw-da export.json "Council of the City of Sydney" 2026-08-01 2026-08-31
 */
import { readFile } from "node:fs/promises";
import { parseNswDaRecords, summariseNswDaPilot } from "./lib/nswDa";

const [path, councilName, from, to] = process.argv.slice(2);
if (!path || !councilName || !from || !to) {
  throw new Error(
    'Usage: pnpm probe:nsw-da <export.json> "<council name>" <YYYY-MM-DD> <YYYY-MM-DD>'
  );
}

const payload: unknown = JSON.parse(await readFile(path, "utf8"));
const records = parseNswDaRecords(payload);
const snapshot = summariseNswDaPilot(records, {
  councilName,
  from,
  to,
  retrievedAt: new Date().toISOString(),
});

console.log(JSON.stringify(snapshot, null, 2));
