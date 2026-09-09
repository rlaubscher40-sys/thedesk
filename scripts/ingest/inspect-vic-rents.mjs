// Read-only source diagnostic. No credentials, database writes or AI calls.
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const sources = [
  ["vic-lga-sep2025.xlsx", "https://www.dffh.vic.gov.au/quarterly-median-rents-local-government-area-september-quarter-2025-excel"],
  ["vic-suburb-sep2025.xlsx", "https://www.dffh.vic.gov.au/moving-annual-rent-suburb-september-quarter-2025-excel"],
];
await mkdir("source-check", { recursive: true });
const report = [];
for (const [file, url] of sources) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(45_000), redirect: "error" });
    if (!response.ok) throw new Error(`Publisher HTTP ${response.status}`);
    if (Number(response.headers.get("content-length")) > 10_000_000) throw new Error("Workbook exceeds size limit");
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 10_000_000) throw new Error("Workbook exceeds size limit");
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error("Response is not an XLSX ZIP");
    await writeFile(`source-check/${file}`, bytes);
    report.push({ file, url, bytes: size, sha256: createHash("sha256").update(bytes).digest("hex"), checkedAt: new Date().toISOString() });
  } catch (error) {
    report.push({ file, url, error: error.message, checkedAt: new Date().toISOString() });
    // Do not retry an access refusal or query other paths at the same publisher.
    if (/HTTP (401|403|429)/.test(error.message)) break;
  }
}
await writeFile("source-check/report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.some(row => row.error)) process.exitCode = 1;
