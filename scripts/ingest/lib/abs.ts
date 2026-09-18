/** National macro metrics read from explicit ABS release-table contracts.
 * A matching number in page prose never authorises a different measure/period.
 * API discovery remains a separate probe; no guessed series is used here.
 */
import { parse, type DefaultTreeAdapterMap } from "parse5";

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
const months = [
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

type Contract = {
  metricKey: string;
  title: string;
  path: string;
  caption: string;
  column: string;
  row?: string;
  quarterly?: boolean;
  percent?: boolean;
  label: string;
  context: string;
  groupKey: string;
  displayOrder: number;
};
const contracts: Contract[] = [
  {
    metricKey: "cpi_trimmed",
    title: "Consumer Price Index, Australia",
    path: "economy/price-indexes-and-inflation/consumer-price-index-australia",
    caption: "All groups CPI and Trimmed mean, Australia, annual movement (%)",
    column: "Trimmed mean (%)",
    percent: true,
    label: "Trimmed mean CPI",
    context: "ABS · annual change · monthly reference period",
    groupKey: "MACRO",
    displayOrder: 20,
  },
  {
    metricKey: "unemployment",
    title: "Labour Force, Australia",
    path: "labour/employment-and-unemployment/labour-force-australia",
    caption: "Key statistics - Seasonally adjusted",
    column: "",
    row: "Unemployment rate",
    percent: true,
    label: "Unemployment rate",
    context: "ABS · Australia · seasonally adjusted",
    groupKey: "LABOUR",
    displayOrder: 70,
  },
  {
    metricKey: "wage_growth",
    title: "Wage Price Index, Australia",
    path: "economy/price-indexes-and-inflation/wage-price-index-australia",
    caption: "All sector WPI, quarterly and annual movement (%), seasonally adjusted (a)",
    column: "Annual (%)",
    quarterly: true,
    percent: true,
    label: "Wage growth (WPI)",
    context: "ABS · annual change · all sectors · seasonally adjusted",
    groupKey: "LABOUR",
    displayOrder: 80,
  },
  {
    metricKey: "building_approvals",
    title: "Building Approvals, Australia",
    path: "industry/building-and-construction/building-approvals-australia",
    caption: "Dwelling units approved (a)",
    column: "Seasonally adjusted (no.)",
    label: "Building approvals",
    context: "ABS · monthly total dwellings · Australia · seasonally adjusted",
    groupKey: "PROPERTY",
    displayOrder: 60,
  },
  {
    metricKey: "net_migration",
    title: "National, state and territory population",
    path: "people/population/national-state-and-territory-population",
    caption: "Components of annual population change(a)",
    column: "Net overseas migration",
    quarterly: true,
    label: "Net overseas migration",
    context: "ABS · year ending reference quarter · Australia · persons",
    groupKey: "DEMOGRAPHICS",
    displayOrder: 120,
  },
];
export type AbsResult = {
  metricKey: string;
  label: string;
  value: string;
  unit: string;
  context: string;
  groupKey: string;
  source: string;
  sourceUrl: string;
  asOf: Date;
  displayOrder: number;
} | null;

/** Match one title, reference field, table, header and dated cell. An absent,
 * suppressed, duplicate or structurally changed current observation is withheld.
 * Old rows and next-release notices cannot supply a replacement value/date. */
export function parseAbsRelease(metricKey: string, html: string, now = new Date()): AbsResult {
  const spec = contracts.find((c) => c.metricKey === metricKey);
  if (!spec || html.length > 2_000_000 || !Number.isFinite(now.getTime())) return null;
  const doc = parse(html);
  const headings = elements(doc, "h1");
  if (headings.length !== 1 || text(headings[0]!) !== spec.title) return null;
  const refs = elements(doc, "div").filter((n) =>
    n.attrs.some(
      (a) =>
        a.name === "class" &&
        a.value.split(/\s+/).includes("field--name-field-abs-reference-period")
    )
  );
  if (refs.length !== 1) return null;
  const ref = /^Reference period ([A-Za-z]+) (20\d{2})$/.exec(text(refs[0]!));
  if (!ref) return null;
  const month = months.indexOf(ref[1]!);
  if (month < 0 || (spec.quarterly && ![2, 5, 8, 11].includes(month))) return null;
  const asOf = new Date(Date.UTC(Number(ref[2]), month, 1));
  const currentMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  if (asOf.getTime() >= currentMonth) return null;
  const periodLabel = `${months[month]!.slice(0, 3)}-${ref[2]!.slice(-2)}`;
  const tables = elements(doc, "table").filter((t) => {
    const captions = elements(t, "caption");
    return captions.length === 1 && text(captions[0]!) === spec.caption;
  });
  if (tables.length !== 1) return null;
  const table = tables[0]!;
  if (elements(table, "table").length !== 1) return null;
  const rows = elements(table, "tr").map((r) =>
    children(r).filter((c): c is Element => "tagName" in c && ["td", "th"].includes(c.tagName))
  );
  if (
    rows.length < 2 ||
    rows.some((r) => !r.length) ||
    rows.some((r) =>
      r.some((c) => c.attrs.some((a) => ["rowspan", "colspan"].includes(a.name) && a.value !== "1"))
    )
  )
    return null;
  const header = rows[0]!.map(text);
  const column = spec.row ? periodLabel : spec.column;
  if (header.filter((h) => h === column).length !== 1) return null;
  const index = header.indexOf(column);
  if (index < 1) return null;
  const matches = rows.slice(1).filter((r) => text(r[0]!) === (spec.row ?? periodLabel));
  if (matches.length !== 1 || matches[0]!.length !== header.length) return null;
  const raw = text(matches[0]![index]!);
  // Rates have one decimal in these tables. Population/approvals are persons/units,
  // never thousands or a percentage. Reject footnotes, missing values and bad commas.
  const pattern = spec.percent
    ? spec.row
      ? /^-?\d+(?:\.\d+)?%$/
      : /^-?\d+(?:\.\d+)?$/
    : /^-?(?:\d+|\d{1,3}(?:,\d{3})+)$/;
  if (!pattern.test(raw)) return null;
  const number = Number(raw.replace(/[,％%]/g, ""));
  if (
    !Number.isFinite(number) ||
    (spec.percent && (number < -100 || number > 100)) ||
    (!spec.percent && !Number.isSafeInteger(number)) ||
    (metricKey === "unemployment" && number < 0) ||
    (metricKey === "building_approvals" && number < 0)
  )
    return null;
  return {
    metricKey,
    label: spec.label,
    value: spec.percent ? number.toFixed(1) : number.toLocaleString("en-AU"),
    unit: spec.percent ? "%" : "",
    context: spec.context,
    groupKey: spec.groupKey,
    source: "ABS",
    sourceUrl: `https://www.abs.gov.au/statistics/${spec.path}/latest-release`,
    asOf,
    displayOrder: spec.displayOrder,
  };
}

export async function fetchAllAbs(
  onSourceError?: (metricKey: string, reason: string) => void
): Promise<AbsResult[]> {
  return Promise.all(
    contracts.map(async (spec) => {
      const url = `https://www.abs.gov.au/statistics/${spec.path}/latest-release`;
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; TheDeskBot/1.0; +https://thedesk.au)",
            Accept: "text/html",
          },
          signal: AbortSignal.timeout(30_000),
          redirect: "error",
        });
        if (!res.ok) throw new Error(`ABS release HTTP ${res.status}`);
        const html = await res.text();
        const result = parseAbsRelease(spec.metricKey, html);
        if (!result)
          throw new Error("ABS release table, measure or reference period could not be verified");
        return result;
      } catch (error) {
        const reason = error instanceof Error ? error.message : "ABS release unavailable";
        console.warn(`[abs] ${spec.metricKey}: ${reason}`);
        onSourceError?.(spec.metricKey, reason);
        return null;
      }
    })
  );
}
