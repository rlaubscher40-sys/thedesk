import { parse, type DefaultTreeAdapterMap } from "parse5";
import {
  LABOUR_SOURCE,
  LABOUR_STATES,
  type LabourObservation,
  type StateLabour,
} from "../../shared/stateLabour";
import { STATE_CODES } from "../../shared/localData";
import { cached } from "../core/cache";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];
const children = (node: Node): Node[] => ("childNodes" in node ? node.childNodes : []);
function elements(node: Node, tag: string): Element[] {
  return [
    ...("tagName" in node && node.tagName === tag ? [node] : []),
    ...children(node).flatMap((child) => elements(child, tag)),
  ];
}
function text(node: Node): string {
  if ("value" in node) return node.value;
  if ("tagName" in node && ["script", "style"].includes(node.tagName)) return "";
  return children(node).map(text).join(" ").replace(/\s+/g, " ").trim();
}
const MONTHS = [
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
];
const fail = (): never => {
  throw new Error("ABS state labour table, period or measure could not be verified");
};
/** One consistent TREND table covers all eight jurisdictions. Do not mix the
 * six-state seasonally adjusted table with territory trend estimates. */
export function parseAbsLabour(html: string, retrievedAt: string): StateLabour {
  if (html.length > 2_000_000 || !Number.isFinite(Date.parse(retrievedAt))) fail();
  const doc = parse(html);
  const headings = elements(doc, "h1");
  if (headings.length !== 1 || text(headings[0]!) !== "Labour Force, Australia") fail();
  const refs = elements(doc, "div").filter((n) =>
    n.attrs.some(
      (a) =>
        a.name === "class" &&
        a.value.split(/\s+/).includes("field--name-field-abs-reference-period")
    )
  );
  if (refs.length !== 1) fail();
  const ref = /^Reference period ([A-Za-z]+) (20\d{2})$/.exec(text(refs[0]!));
  if (!ref || !MONTHS.includes(ref[1]!)) fail();
  const period = `${ref![2]}-${String(MONTHS.indexOf(ref![1]!) + 1).padStart(2, "0")}`;
  if (period >= retrievedAt.slice(0, 7)) fail();
  const tables = elements(doc, "table").filter((t) => {
    const captions = elements(t, "caption");
    return captions.length === 1 && text(captions[0]!) === `${ref![1]} ${ref![2]} - Trend`;
  });
  if (tables.length !== 1 || elements(tables[0]!, "table").length !== 1) fail();
  const rows = elements(tables[0]!, "tr").map((r) =>
    children(r).filter((c): c is Element => "tagName" in c && ["th", "td"].includes(c.tagName))
  );
  if (
    rows.length < 2 ||
    rows.some(
      (r) =>
        !r.length ||
        r.some((c) =>
          c.attrs.some((a) => ["rowspan", "colspan"].includes(a.name) && a.value !== "1")
        )
    )
  )
    fail();
  const header = rows[0]!.map(text);
  if (
    header.length !== 10 ||
    new Set(header).size !== header.length ||
    header[0] !== "" ||
    !header.includes("Australia") ||
    STATE_CODES.some((s) => !header.includes(LABOUR_STATES[s]))
  )
    fail();
  const measures = {
    employedPeople: "Employed people",
    employmentMonthlyPercent: "Employed people - monthly change",
    unemploymentPercent: "Unemployment rate",
    participationPercent: "Participation rate",
  } as const;
  const observations = STATE_CODES.map((state) => {
    const row: LabourObservation = {
      state,
      employedPeople: 0,
      employmentMonthlyPercent: 0,
      unemploymentPercent: 0,
      participationPercent: 0,
    };
    for (const key of Object.keys(measures) as Array<keyof typeof measures>) {
      const matching = rows.slice(1).filter((r) => text(r[0]!) === measures[key]);
      if (matching.length !== 1 || matching[0]!.length !== header.length) fail();
      const raw = text(matching[0]![header.indexOf(LABOUR_STATES[state])]!);
      const count = key === "employedPeople";
      if (!(count ? /^(?:\d+|\d{1,3}(?:,\d{3})+)$/ : /^-?\d+(?:\.\d+)?%$/).test(raw)) fail();
      const value = Number(raw.replace(/[,%]/g, ""));
      if (
        !Number.isFinite(value) ||
        (count
          ? !Number.isSafeInteger(value) || value <= 0
          : value < (key === "employmentMonthlyPercent" ? -100 : 0) || value > 100)
      )
        fail();
      row[key] = value;
    }
    return row;
  });
  return {
    status: "available",
    period,
    retrievedAt,
    sourceUrl: LABOUR_SOURCE.replace(
      "latest-release",
      `${ref![1]!.slice(0, 3).toLowerCase()}-${ref![2]}`
    ),
    observations,
  };
}

export async function getStateLabour(): Promise<StateLabour> {
  return cached("abs:labour:attempt", 60_000, async () => {
    try {
      return await cached("abs:labour:data", 3_600_000, async () => {
        const retrievedAt = new Date().toISOString();
        const response = await fetch(LABOUR_SOURCE, {
          headers: { Accept: "text/html" },
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
        });
        if (
          !response.ok ||
          !(response.headers.get("content-type") ?? "").startsWith("text/html") ||
          Number(response.headers.get("content-length")) > 2_000_000
        )
          fail();
        const reader = response.body?.getReader();
        if (!reader) fail();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          for (;;) {
            const { done, value } = await reader!.read();
            if (done) break;
            size += value.byteLength;
            if (size > 2_000_000) fail();
            chunks.push(value);
          }
        } finally {
          await reader!.cancel();
        }
        return parseAbsLabour(Buffer.concat(chunks).toString("utf8"), retrievedAt);
      });
    } catch {
      console.warn("[metrics] ABS state labour unavailable or unverified");
      return {
        status: "unavailable",
        period: null,
        retrievedAt: null,
        sourceUrl: LABOUR_SOURCE,
        observations: [],
      };
    }
  });
}
