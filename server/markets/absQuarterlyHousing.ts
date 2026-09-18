import { parse, type DefaultTreeAdapterMap } from "parse5";
import { cached } from "../core/cache";
import { readWorkbook } from "../localData/workbook";
import type { Sheet } from "../localData/parsers";
import { STATE_CODES } from "../../shared/localData";
import { LABOUR_STATES } from "../../shared/stateLabour";
import {
  TRANSFER_AREAS,
  TRANSFER_SOURCE,
  COMPLETION_SOURCE,
  quarterIndex,
  type HousingTransfers,
  type HousingCompletions,
} from "../../shared/quarterlyHousing";

type Kind = "transfers" | "completions";
type Node = DefaultTreeAdapterMap["node"];
const kids = (n: Node): Node[] => ("childNodes" in n ? n.childNodes : []);
const all = (n: Node, tag: string): DefaultTreeAdapterMap["element"][] => [
  ...("tagName" in n && n.tagName === tag ? [n] : []),
  ...kids(n).flatMap((c) => all(c, tag)),
];
const words = (n: Node): string =>
  ("value" in n ? n.value : kids(n).map(words).join(" ")).replace(/\s+/g, " ").trim();
const MONTHS = ["March", "June", "September", "December"];
const SETTINGS = {
  transfers: {
    title: "Total Value of Dwellings",
    catalogue: "6432.0 Total Value of Dwellings",
    table: "Table 2. Median Price and Number of Transfers (Capital City and Rest of State)",
    file: "643202.xlsx",
    source: TRANSFER_SOURCE,
  },
  completions: {
    title: "Building Activity, Australia",
    catalogue: "8752.0 Building Activity, Australia",
    table:
      "TABLE 39. Number of Dwelling Unit Completions by Sector, States and Territories: Original",
    file: "87520039.xlsx",
    source: COMPLETION_SOURCE,
  },
};
const fail = (): never => {
  throw new Error("ABS quarterly housing source contract failed");
};
export function quarterlyRelease(html: string, kind: Kind, retrievedAt: string) {
  if (html.length > 2_000_000 || !Number.isFinite(Date.parse(retrievedAt))) fail();
  const setting = SETTINGS[kind],
    doc = parse(html),
    titles = all(doc, "h1");
  if (titles.length !== 1 || words(titles[0]!) !== setting.title) fail();
  const refs = all(doc, "div").filter((n) =>
    n.attrs.some(
      (a) =>
        a.name === "class" &&
        a.value.split(/\s+/).includes("field--name-field-abs-reference-period")
    )
  );
  if (refs.length !== 1) fail();
  const match = /^Reference period (March|June|September|December)( Quarter)? (20\d{2})$/.exec(
    words(refs[0]!)
  );
  if (!match || Boolean(match[2]) !== (kind === "transfers")) fail();
  const period = `${match![3]}-Q${MONTHS.indexOf(match![1]!) + 1}`;
  const now = new Date(retrievedAt);
  if (quarterIndex(period) >= now.getUTCFullYear() * 4 + Math.floor(now.getUTCMonth() / 3)) fail();
  const sourceUrl = setting.source.replace(
    "latest-release",
    `${match![1]!.slice(0, 3).toLowerCase()}${kind === "transfers" ? "-quarter" : ""}-${match![3]}`
  );
  const resourceUrl = `${sourceUrl}/${setting.file}`;
  const links = all(doc, "a").flatMap((n) =>
    n.attrs
      .filter((a) => a.name === "href")
      .map((a) => {
        try {
          return new URL(a.value, setting.source).href;
        } catch {
          return "";
        }
      })
  );
  if (!links.includes(resourceUrl)) fail();
  return { period, sourceUrl, resourceUrl };
}

function dateQuarter(value: unknown): string | null {
  if (
    !(value instanceof Date) ||
    !Number.isFinite(value.getTime()) ||
    value.getUTCDate() !== 1 ||
    ![2, 5, 8, 11].includes(value.getUTCMonth())
  )
    return null;
  return `${value.getUTCFullYear()}-Q${Math.floor(value.getUTCMonth() / 3) + 1}`;
}
function workbookTable(sheets: Sheet[], kind: Kind, period: string) {
  const setting = SETTINGS[kind];
  const indexes = sheets.filter((s) => s.sheet === "Index"),
    tables = sheets.filter((s) => s.sheet === "Data1");
  if (
    indexes.length !== 1 ||
    tables.length !== 1 ||
    indexes[0]!.data[4]?.[1] !== setting.catalogue ||
    indexes[0]!.data[5]?.[1] !== setting.table
  )
    fail();
  const rows = tables[0]!.data;
  if (rows.length < 14 || rows.length > 2000 || rows[0]!.length > 128) fail();
  const labels = [
    "Unit",
    "Series Type",
    "Data Type",
    "Frequency",
    "Collection Month",
    "Series Start",
    "Series End",
    "No. Obs",
    "Series ID",
  ];
  if (labels.some((label, i) => rows[i + 1]?.[0] !== label)) fail();
  const ids = rows[9]!.slice(1),
    headings = rows[0]!.slice(1);
  if (
    new Set(ids).size !== ids.length ||
    new Set(headings).size !== headings.length ||
    ids.some((id) => typeof id !== "string" || !/^A\d+[A-Z]$/.test(id))
  )
    fail();
  const dates = rows.slice(10).map((r) => dateQuarter(r[0]));
  if (
    dates.some((p) => !p) ||
    new Set(dates).size !== dates.length ||
    dates.at(-1) !== period ||
    dates.some((p, i) => i > 0 && quarterIndex(p!) !== quarterIndex(dates[i - 1]!) + 1)
  )
    fail();
  const series = (heading: string, unit: string) => {
    const columns = rows[0]!.flatMap((h, i) => (h === heading ? [i] : []));
    if (columns.length !== 1) fail();
    const c = columns[0]!;
    if (
      rows[1]?.[c] !== unit ||
      rows[2]?.[c] !== "Original" ||
      rows[3]?.[c] !== "FLOW" ||
      rows[4]?.[c] !== "Quarter" ||
      rows[5]?.[c] !== 3 ||
      dateQuarter(rows[7]?.[c]) !== period
    )
      fail();
    return (offset: number): number | null => {
      const v = rows[rows.length - 1 - offset]?.[c];
      if (v == null || v === "np" || v === "..") return null;
      if (
        typeof v !== "number" ||
        !Number.isFinite(v) ||
        v < 0 ||
        (unit === "Number" && !Number.isSafeInteger(v)) ||
        (unit !== "Number" && v === 0)
      )
        fail();
      return unit === "$'000" ? Math.round((v as number) * 1000) : (v as number);
    };
  };
  return { series, periods: dates.slice(-8).reverse() as string[] };
}
export function parseHousingTransfers(
  sheets: Sheet[],
  release: ReturnType<typeof quarterlyRelease>,
  retrievedAt: string
): HousingTransfers {
  const { series, periods } = workbookTable(sheets, "transfers", release.period);
  const observations = TRANSFER_AREAS.flatMap((area) => {
    const house = series(
      `Median Price of Established House Transfers (Unstratified) ;  ${area} ;`,
      "$'000"
    );
    const attached = series(
      `Median Price of Attached Dwelling Transfers (Unstratified) ;  ${area} ;`,
      "$'000"
    );
    const houseCount = series(`Number of Established House Transfers ;  ${area} ;`, "Number");
    const attachedCount = series(`Number of Attached Dwelling Transfers ;  ${area} ;`, "Number");
    return periods.map((period, i) => {
      const row = {
        area,
        period,
        houseMedian: house(i),
        attachedMedian: attached(i),
        houseTransfers: houseCount(i),
        attachedTransfers: attachedCount(i),
      };
      if (
        (row.houseTransfers === 0 && row.houseMedian !== null) ||
        (row.attachedTransfers === 0 && row.attachedMedian !== null)
      )
        fail();
      return row;
    });
  });
  return { status: "available", ...release, retrievedAt, observations };
}
export function parseHousingCompletions(
  sheets: Sheet[],
  release: ReturnType<typeof quarterlyRelease>,
  retrievedAt: string
): HousingCompletions {
  const { series, periods } = workbookTable(sheets, "completions", release.period);
  const observations = STATE_CODES.flatMap((state) => {
    const count = series(
      `Dwelling units completed ;  Total Sectors ;  Total (Type of Building) ;  Total (Type of Work) ;  ${LABOUR_STATES[state]} ;`,
      "Number"
    );
    return periods.map((period, i) => {
      const year = [0, 1, 2, 3].map((j) => count(i + j));
      return {
        state,
        period,
        quarter: count(i),
        year: year.some((n) => n === null) ? null : year.reduce<number>((sum, n) => sum + n!, 0),
      };
    });
  });
  return { status: "available", ...release, retrievedAt, observations };
}
async function bounded(url: string, kind: Kind, signal: AbortSignal, html: boolean) {
  const setting = SETTINGS[kind];
  const root = setting.source.replace("latest-release", "");
  if (
    url !== setting.source &&
    !new RegExp(
      `^${root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:mar|jun|sep|dec)${kind === "transfers" ? "-quarter" : ""}-20\\d{2}/${setting.file.replace(".", "\\.")}$`
    ).test(url)
  )
    fail();
  const response = await fetch(url, {
    headers: {
      Accept: html
        ? "text/html"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    signal,
    redirect: "error",
  });
  const limit = html ? 2_000_000 : 1_000_000;
  const mime = response.headers.get("content-type") ?? "";
  if (
    !response.ok ||
    !mime.startsWith(
      html ? "text/html" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) ||
    Number(response.headers.get("content-length")) > limit
  ) {
    await response.body?.cancel();
    fail();
  }
  const reader = response.body?.getReader();
  if (!reader) fail();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader!.read();
      if (done) break;
      size += value.length;
      if (size > limit) fail();
      chunks.push(value);
    }
  } finally {
    await reader!.cancel();
  }
  return Buffer.concat(chunks);
}
async function collect(kind: Kind): Promise<HousingTransfers | HousingCompletions> {
  return cached(`abs:housing:${kind}:attempt`, 60_000, async () => {
    try {
      return await cached(`abs:housing:${kind}:data`, 6 * 3_600_000, async () => {
        const retrievedAt = new Date().toISOString(),
          signal = AbortSignal.timeout(20_000);
        const release = quarterlyRelease(
          (await bounded(SETTINGS[kind].source, kind, signal, true)).toString("utf8"),
          kind,
          retrievedAt
        );
        const sheets = await readWorkbook(
          await bounded(release.resourceUrl, kind, signal, false),
          signal,
          "abs-cpi"
        );
        return kind === "transfers"
          ? parseHousingTransfers(sheets, release, retrievedAt)
          : parseHousingCompletions(sheets, release, retrievedAt);
      });
    } catch {
      console.warn(`[metrics] ABS ${kind} unavailable or unverified`);
      return {
        status: "unavailable" as const,
        period: null,
        retrievedAt: null,
        sourceUrl: SETTINGS[kind].source,
        resourceUrl: null,
        observations: [],
      };
    }
  });
}
export const getHousingTransfers = () => collect("transfers") as Promise<HousingTransfers>;
export const getHousingCompletions = () => collect("completions") as Promise<HousingCompletions>;
