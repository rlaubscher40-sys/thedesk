import { normaliseArea, type LocalArea, type LocalObservation } from "../../shared/localData";
import type { Sheet } from "./parsers";

export const VIC_RENT_SHEETS = [
  ["1br flat", "1 bedroom flats", "Flat 1 bedrooms"],
  ["2br Flat", "2 bedroom flats", "Flat 2 bedrooms"],
  ["3br Flat", "3 bedroom flats", "Flat 3 bedrooms"],
  ["2br House", "2 bedroom house", "House 2 bedrooms"],
  ["3br House", "3 bedroom house", "House 3 bedrooms"],
  ["4br House", "4 bedroom house", "House 4 bedrooms"],
  ["All Properties", "All properties", "All properties"],
] as const;

// Exact names in the reviewed publisher table, not inferred suburb boundaries.
export const VIC_LGAS = [
  "Colac-Otway",
  "Corangamite",
  "Glenelg",
  "Greater Geelong",
  "Moyne",
  "Queenscliffe",
  "Southern Grampians",
  "Surf Coast",
  "Warrnambool",
  "Ararat",
  "Ballarat",
  "Golden Plains",
  "Hepburn",
  "Hindmarsh",
  "Horsham",
  "Moorabool",
  "Northern Grampians",
  "Pyrenees",
  "West Wimmera",
  "Yarriambiack",
  "Buloke",
  "Campaspe",
  "Central Goldfields",
  "Gannawarra",
  "Greater Bendigo",
  "Loddon",
  "Macedon Ranges",
  "Mildura",
  "Mount Alexander",
  "Swan Hill",
  "Alpine",
  "Benalla",
  "Greater Shepparton",
  "Indigo",
  "Mansfield",
  "Mitchell",
  "Moira",
  "Murrindindi",
  "Strathbogie",
  "Towong",
  "Wangaratta",
  "Wodonga",
  "Bass Coast",
  "Baw Baw",
  "East Gippsland",
  "Latrobe",
  "South Gippsland",
  "Wellington",
  "Banyule",
  "Brimbank",
  "Darebin",
  "Hobsons Bay",
  "Hume",
  "Maribyrnong",
  "Melbourne",
  "Melton",
  "Merri-bek",
  "Moonee Valley",
  "Nillumbik",
  "Whittlesea",
  "Wyndham",
  "Yarra",
  "Boroondara",
  "Knox",
  "Manningham",
  "Maroondah",
  "Monash",
  "Whitehorse",
  "Yarra Ranges",
  "Bayside",
  "Cardinia",
  "Casey",
  "Frankston",
  "Glen Eira",
  "Greater Dandenong",
  "Kingston",
  "Mornington Penin'a",
  "Port Phillip",
  "Stonnington",
] as const;
const AGGREGATES = new Set(["Group Total", "Victoria", "Metro", "Non-Metro"]);
function requireValue(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`Victoria rents: ${message}`);
}
function quarter(value: unknown) {
  const m = typeof value === "string" && /^(Mar|Jun|Sep|Dec) (\d{4})$/.exec(value);
  requireValue(m && Number(m[2]) >= 1999 && Number(m[2]) <= 2099, "invalid reporting quarter");
  const month = ["Mar", "Jun", "Sep", "Dec"].indexOf(m[1]!) * 3 + 3;
  return {
    index: Number(m[2]) * 12 + month,
    period: new Date(Date.UTC(Number(m[2]), month, 0)).toISOString().slice(0, 10),
  };
}

/** Store five explicit quarters, supporting a same-quarter prior-year comparison.
 * Source dashes remain unavailable; their reason is not guessed from counts.
 * Published counts are contextual, never combined to reconstruct suppressed values. */
export function parseVicRents(sheets: Sheet[], expectedPeriod: string) {
  requireValue(sheets.length === VIC_RENT_SHEETS.length, "worksheet set changed");
  const areas = new Map<string, LocalArea>();
  let commonPeriods: string[] | undefined;
  let excludedRows = 0;
  for (const [name, label, category] of VIC_RENT_SHEETS) {
    const found = sheets.filter((s) => s.sheet === name);
    requireValue(found.length === 1, `missing or duplicate worksheet ${name}`);
    const rows = found[0]!.data;
    requireValue(
      rows[0]?.[0] === "Quarterly median rents by Local Government Area" && rows[1]?.[0] === label,
      "table identity changed"
    );
    const headers = rows[1]!;
    requireValue(
      headers.length >= 12 && headers.length <= 256 && headers.length % 2 === 0,
      "quarter columns changed"
    );
    const periods: string[] = [];
    let lastIndex: number | undefined;
    for (let c = 2; c < headers.length; c += 2) {
      const q = quarter(headers[c]);
      requireValue(
        headers[c] === headers[c + 1] && rows[2]?.[c] === "Count" && rows[2]?.[c + 1] === "Median",
        "count/median headers changed"
      );
      requireValue(
        lastIndex === undefined || q.index === lastIndex + 3,
        "quarters duplicated, missing or reordered"
      );
      lastIndex = q.index;
      periods.push(q.period);
    }
    requireValue(
      periods.at(-1) === expectedPeriod,
      "workbook does not match the reviewed release period"
    );
    requireValue(
      !commonPeriods || JSON.stringify(commonPeriods) === JSON.stringify(periods),
      "worksheets have different periods"
    );
    commonPeriods = periods;
    const seen = new Set<string>();
    for (const row of rows.slice(3)) {
      const rawName = row[1];
      if (rawName == null) continue; // Blank rows and legacy notes outside the geography column.
      requireValue(typeof rawName === "string", "invalid geography name");
      if (AGGREGATES.has(rawName)) {
        excludedRows++;
        continue;
      }
      requireValue(
        (VIC_LGAS as readonly string[]).includes(rawName),
        `unreviewed geography ${rawName}`
      );
      requireValue(!seen.has(rawName), `duplicate council ${rawName}`);
      seen.add(rawName);
      const displayName = rawName === "Mornington Penin'a" ? "Mornington Peninsula" : rawName;
      const area: LocalArea = areas.get(rawName) ?? {
        id: `vic:lga:${normaliseArea(displayName)}`,
        name: displayName,
        state: "VIC",
        kind: "LGA",
        boundaryVersion:
          "Homes Victoria publisher-defined council boundaries; not suburb boundaries",
        observations: [],
      };
      for (let p = periods.length - 5; p < periods.length; p++) {
        const c = 2 + p * 2,
          count = row[c],
          median = row[c + 1];
        const validCount =
          typeof count === "number" &&
          Number.isSafeInteger(count) &&
          count >= 0 &&
          count <= 1_000_000;
        const validMedian =
          typeof median === "number" && Number.isFinite(median) && median > 0 && median <= 10000;
        requireValue(count === "-" || validCount, `invalid count for ${rawName}`);
        requireValue(median === "-" || validMedian, `invalid median for ${rawName}`);
        requireValue(
          !validMedian || (validCount && count > 0),
          `published median without a positive count for ${rawName}`
        );
        const observation: LocalObservation = {
          measure: "weekly-rent",
          value: validMedian ? median : null,
          unit: "AUD/week",
          period: periods[p]!,
          category,
          sample: validCount ? count : null,
          status: validMedian ? "published" : "source-unavailable",
        };
        area.observations.push(observation);
      }
      areas.set(rawName, area);
    }
    requireValue(seen.size === VIC_LGAS.length, "council coverage changed");
  }
  return { areas: [...areas.values()], period: expectedPeriod, excludedRows };
}
