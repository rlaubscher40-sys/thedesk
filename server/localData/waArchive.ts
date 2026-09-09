import { inflateRaw } from "node:zlib";
import { promisify } from "node:util";
import { inspectZip } from "./workbook";
import { monthEnd, parseWaBonds } from "./stateRents";

// Quoted CSV is parsed as data; no formulas, filesystem extraction or archive metadata are retained.
export function parseRentCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false,
    closed = false;
  const text = input.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += c;
    } else if (c === '"' && !value && !closed) quoted = true;
    else if (c === "," || c === "\n" || c === "\r") {
      row.push(value);
      value = "";
      closed = false;
      if (c !== ",") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        if (row.some((v) => v.length)) rows.push(row);
        row = [];
      }
    } else {
      if (closed || c === '"') throw new Error("Invalid quoted rental CSV");
      value += c;
    }
    if (value.length > 500 || row.length > 4 || rows.length > 100000)
      throw new Error("Rental CSV exceeds limits");
  }
  if (quoted) throw new Error("Unclosed rental CSV field");
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

export async function parseWaArchive(
  bytes: Buffer,
  month: string,
  signal?: AbortSignal,
) {
  const end = monthEnd(month);
  const date = `01-${month.slice(5)}-${month.slice(0, 4)}-${end.slice(8)}-${month.slice(5)}-${month.slice(0, 4)}`;
  const name = `wa-rental-bond/Monthly Bond Lodgement Summary (CSV)-(${date}).csv`;
  const entry = inspectZip(bytes, 2048).find((e) => e.name === name);
  if (!entry || entry.raw > 5_000_000)
    throw new Error("WA monthly lodgements missing or oversized");
  signal?.throwIfAborted();
  const compressed = bytes.subarray(
    entry.start,
    entry.start + entry.compressed,
  );
  const data =
    entry.method === 0
      ? compressed
      : await promisify(inflateRaw)(compressed, { maxOutputLength: 5_000_000 });
  signal?.throwIfAborted();
  if (data.length !== entry.raw)
    throw new Error("WA ZIP entry length mismatch");
  return parseWaBonds(parseRentCsv(data.toString("utf8")), month);
}
