import fs from "node:fs/promises";
import path from "node:path";
import { newDocumentaryBrief } from "../server/video/documentaryProduction";
const [id, subject, output, series = "Property Empires"] = process.argv.slice(2);
if (
  !id ||
  !subject ||
  !output ||
  !path.isAbsolute(output) ||
  !["The Deal", "Property Empires"].includes(series)
)
  throw new Error(
    'Use: node --import tsx scripts/new-documentary.ts <id> "Subject" /absolute/new-directory ["The Deal"|"Property Empires"]'
  );
const brief = newDocumentaryBrief(id, subject, series as "The Deal" | "Property Empires");
await fs.mkdir(output);
await fs.writeFile(path.join(output, "production-brief.json"), JSON.stringify(brief, null, 2));
console.log(JSON.stringify({ id, status: brief.status, output, posted: false }));
