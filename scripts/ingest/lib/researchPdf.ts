import { Worker } from "node:worker_threads";
import { missingPublicationDate } from "./publicationDate";
import type { SourceTiming } from "../../../shared/sourceTiming";

const MAX_BYTES = 2 * 1024 * 1024;
type PublicationDate = Pick<
  SourceTiming,
  "publisherPublishedAt" | "publisherPublishedDay" | "publisherDateStatus"
>;
export function isResearchPdfUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      ["sqmresearch.com.au", "www.sqmresearch.com.au"].includes(url.hostname) &&
      /^\/uploads\/\d{2}-\d{2}-\d{2}-[^/]+\.pdf$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

/** SQM prints the original release day above "Key Points". Require agreement
 * with its dated release URL; PDF creation/modification metadata is not news
 * publication evidence. Reporting months elsewhere in the document stay data. */
export function researchPdfDate(firstPage: string, url: string): PublicationDate {
  if (!isResearchPdfUrl(url)) return { ...missingPublicationDate };
  const header = firstPage.split(/Key\s+Points/i)[0]!.slice(0, 1200);
  // PDF glyph runs may split the day ("1 3 August"). Accept that only on a
  // standalone header date line and still require the release URL to agree.
  const dates = [
    ...header.matchAll(
      /^[ \t]*([0-3]?[ \t]*\d)[ \t]+(January|February|March|April|May|June|July|August|September|October|November|December)[ \t]+(20\d{2})[ \t]*$/gm
    ),
  ];
  if (!dates.length) return { ...missingPublicationDate };
  if (dates.length !== 1) return { publisherPublishedAt: null, publisherDateStatus: "conflicting" };
  const match = dates[0]!;
  const month =
    [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ].indexOf(match[2]!) + 1;
  const day = `${match[3]}-${String(month).padStart(2, "0")}-${match[1]!.replace(/\s/g, "").padStart(2, "0")}`;
  const parsed = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day)
    return { publisherPublishedAt: null, publisherDateStatus: "invalid" };
  const pathDate = /^\/uploads\/(\d{2})-(\d{2})-(\d{2})-/.exec(new URL(url).pathname)!;
  if (day !== `20${pathDate[3]}-${pathDate[2]}-${pathDate[1]}`)
    return { publisherPublishedAt: null, publisherDateStatus: "conflicting" };
  return {
    publisherPublishedAt: null,
    publisherPublishedDay: day,
    publisherDateStatus: "available",
  };
}

// A separate worker gives parsing a real termination deadline. A Promise.race
// around PDF.js on the server thread cannot stop CPU-heavy malformed input.
const WORKER = `
const { parentPort, workerData } = require('node:worker_threads');
(async () => {
 const { getDocumentProxy } = await import('unpdf');
 const pdf = await getDocumentProxy(workerData, { isEvalSupported: false, enableXfa: false, useSystemFonts: false, disableFontFace: true });
 try {
  if (pdf.numPages < 1 || pdf.numPages > 8) throw new Error('Research PDF page limit');
  let text = '', firstPage = '';
  // The audited release layouts put narrative findings on the opening page.
  // Do not flatten later charts/tables into potentially misassociated facts.
  for (let page = 1; page <= 1; page++) {
   const content = await (await pdf.getPage(page)).getTextContent();
   let lines = '';
   for (const item of content.items) {
    if ('str' in item) lines += item.str + (item.hasEOL ? '\\n' : ' ');
    if (lines.length >= 20000) break;
   }
   if (page === 1) firstPage = lines.slice(0, 12000);
   text += lines + '\\n\\n';
  }
  parentPort.postMessage({ text: text.slice(0, 20000), firstPage });
 } finally { await pdf.loadingTask.destroy(); }
})().catch(() => { parentPort.postMessage(null); });
`;

export async function extractResearchPdf(
  bytes: Uint8Array,
  url: string,
  { timeoutMs = 4000, maxChars = 6000 } = {}
) {
  const empty = { text: null, publicationDate: { ...missingPublicationDate } };
  if (
    !isResearchPdfUrl(url) ||
    bytes.byteLength > MAX_BYTES ||
    Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-"
  )
    return empty;
  const result = await new Promise<{ text: string; firstPage: string } | null>((resolve) => {
    const worker = new Worker(WORKER, {
      eval: true,
      execArgv: [],
      workerData: bytes,
      resourceLimits: { maxOldGenerationSizeMb: 96, maxYoungGenerationSizeMb: 16 },
      stdout: true,
      stderr: true,
    });
    let settled = false;
    const finish = (value: { text: string; firstPage: string } | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), Math.min(4000, Math.max(1, timeoutMs)));
    worker.once("message", finish);
    worker.once("error", () => finish(null));
    worker.once("exit", () => finish(null));
    // Drain parser warnings without retaining untrusted document output.
    worker.stdout?.resume();
    worker.stderr?.resume();
  });
  if (!result || !result.text.trim()) return empty;
  return {
    text: researchPdfText(result.text).slice(0, Math.min(6000, Math.max(0, maxChars))) || null,
    publicationDate: researchPdfDate(result.firstPage, url),
  };
}

export function researchPdfText(firstPage: string): string {
  // Remove page furniture and the release header, then retain opening-page
  // prose and bullets. Dates elsewhere remain part of the reported findings.
  return firstPage
    .replace(/Page\s+\d+\s+of\s+\d+/gi, "")
    .replace(
      /^[\s\S]*?\b[0-3]?[ \t]*\d\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}\b\s*/,
      ""
    )
    .replace(/^Key\s+Points\s*/i, "")
    .split(/SQM[’']s calculations of vacancies|National Vacancy Rates\s*$/i)[0]!
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, " ")
    .replace(/\s*•\s*/g, "\n\n")
    .trim();
}
