import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Fallback = { name: string; version: string; identifier: string; source: string; text: string };
const fallbacks: Fallback[] = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../docs/legal/browser-licence-fallbacks.json", import.meta.url)),
    "utf8"
  )
);

/** Vite cannot include licence text omitted by an npm tarball. Fail on new gaps. */
export function completeBrowserLicences(markdown: string): string {
  const sections = markdown.split(/(?=^## )/m);
  if (sections.length < 2) throw new Error("Browser dependency licence inventory is empty");
  return sections
    .map((section, i) => {
      if (!i) return section;
      const [header, ...body] = section.split("\n");
      if (body.join("\n").trim()) return section;
      const fallback = fallbacks.find(
        (entry) => header === `## ${entry.name} - ${entry.version} (${entry.identifier})`
      );
      if (!fallback) throw new Error(`Missing browser licence text: ${header}`);
      return `${header}\n\nSource: ${fallback.source}\n\n${fallback.text.trim()}\n\n`;
    })
    .join("");
}
