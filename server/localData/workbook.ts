import { Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { Sheet } from "./parsers";

/** Reject oversized/ambiguous ZIPs before the maintained workbook parser sees them.
 * The parser then runs off the request thread with its own memory/time budget. */
export function validateWorkbookZip(data: Buffer): void {
  if (data.length < 22 || data.length > 10_000_000)
    throw new Error("Invalid workbook size");
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) {
    if (
      data.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + data.readUInt16LE(i + 20) === data.length
    ) {
      end = i;
      break;
    }
  }
  if (end < 0 || data.readUInt16LE(end + 4) || data.readUInt16LE(end + 6))
    throw new Error("Invalid workbook ZIP");
  const count = data.readUInt16LE(end + 10),
    size = data.readUInt32LE(end + 12),
    start = data.readUInt32LE(end + 16);
  if (
    !count ||
    count > 256 ||
    data.readUInt16LE(end + 8) !== count ||
    start + size !== end
  )
    throw new Error("Invalid workbook directory");
  let at = start,
    expanded = 0;
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (at + 46 > end || data.readUInt32LE(at) !== 0x02014b50)
      throw new Error("Invalid workbook entry");
    const flags = data.readUInt16LE(at + 8),
      method = data.readUInt16LE(at + 10);
    const compressed = data.readUInt32LE(at + 20),
      raw = data.readUInt32LE(at + 24);
    const len = data.readUInt16LE(at + 28),
      extra = data.readUInt16LE(at + 30),
      comment = data.readUInt16LE(at + 32),
      offset = data.readUInt32LE(at + 42);
    const name = data.subarray(at + 46, at + 46 + len).toString("utf8");
    if (
      flags & 1 ||
      ![0, 8].includes(method) ||
      raw > 60_000_000 ||
      names.has(name) ||
      name.includes("..") ||
      name.startsWith("/") ||
      name.includes("\\") ||
      at + 46 + len + extra + comment > end
    )
      throw new Error("Unsafe workbook entry");
    names.add(name);
    expanded += raw;
    if (
      expanded > 180_000_000 ||
      offset + 30 > start ||
      data.readUInt32LE(offset) !== 0x04034b50 ||
      offset +
        30 +
        data.readUInt16LE(offset + 26) +
        data.readUInt16LE(offset + 28) +
        compressed >
        start
    )
      throw new Error("Workbook expansion limit exceeded");
    at += 46 + len + extra + comment;
  }
  if (at !== end || !names.has("xl/workbook.xml"))
    throw new Error("Not an XLSX workbook");
}

export async function readWorkbook(
  data: Buffer,
  signal?: AbortSignal,
): Promise<Sheet[]> {
  validateWorkbookZip(data);
  signal?.throwIfAborted();
  const moduleUrl = pathToFileURL(
    createRequire(import.meta.url).resolve("read-excel-file/node"),
  ).href;
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      `
      const { parentPort, workerData } = require('node:worker_threads');
      import(workerData.moduleUrl).then(async module => {
        const sheets = await module.default(Buffer.from(workerData.data));
        if (sheets.length > 32) throw new Error('Too many worksheets');
        for (const sheet of sheets) {
          if (sheet.data.length > 100000) throw new Error('Too many rows');
          if (sheet.data.some(row => row.length > 128)) throw new Error('Too many columns');
        }
        parentPort.postMessage(sheets);
      }).catch(() => { throw new Error('Workbook parsing failed'); });
    `,
      {
        eval: true,
        execArgv: [],
        workerData: { data, moduleUrl },
        resourceLimits: { maxOldGenerationSizeMb: 384 },
      },
    );
    let finished = false;
    const done = (error?: Error, sheets?: Sheet[]) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      void worker.terminate();
      if (error) reject(error);
      else resolve(sheets!);
    };
    const abort = () => done(new Error("Workbook collection cancelled"));
    const timer = setTimeout(
      () => done(new Error("Workbook parsing timed out")),
      45_000,
    );
    signal?.addEventListener("abort", abort, { once: true });
    worker.once("message", (sheets) => done(undefined, sheets));
    worker.once("error", (error) =>
      done(
        error instanceof Error ? error : new Error("Workbook worker failed"),
      ),
    );
    worker.once("exit", () => {
      if (!finished) done(new Error("Workbook worker stopped"));
    });
    if (signal?.aborted) abort();
  });
}
