import {
  normaliseArea,
  type LocalArea,
  type LocalObservation,
} from "../../shared/localData";
import type { Sheet } from "./parsers";

const text = (v: unknown) =>
  typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
const number = (v: unknown): number | null =>
  (typeof v === "number" ||
    (typeof v === "string" && /^\d+(?:\.\d+)?$/.test(v.trim()))) &&
  Number.isFinite(Number(v))
    ? Number(v)
    : null;
function requireValue(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
export function monthEnd(month: string) {
  requireValue(/^20\d{2}-(0[1-9]|1[012])$/.test(month), "Invalid rental month");
  return new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0),
  )
    .toISOString()
    .slice(0, 10);
}
function sheet(sheets: Sheet[], name: string) {
  const found = sheets.filter((s) => s.sheet === name);
  requireValue(
    found.length === 1,
    `Missing or duplicate rental worksheet: ${name}`,
  );
  return found[0]!.data;
}
function rent(
  value: number | null,
  period: string,
  category: string,
  sample: number | null,
  enough: boolean,
): LocalObservation {
  return {
    measure: "weekly-rent",
    value: enough ? value : null,
    unit: "AUD/week",
    period,
    category,
    sample,
    status: !enough
      ? "insufficient-sample"
      : value === null
        ? "suppressed"
        : "published",
  };
}
function finish(areas: LocalArea[], period: string, excludedRows = 0) {
  requireValue(
    areas.length > 0 &&
      areas.some((a) => a.observations.some((o) => o.value !== null)),
    "No publishable rental observations",
  );
  requireValue(
    new Set(areas.map((a) => a.id)).size === areas.length,
    "Duplicate rental geography",
  );
  return { areas, period, excludedRows };
}

export function parseSaBonds(sheets: Sheet[], month: string) {
  const period = monthEnd(month),
    areas: LocalArea[] = [];
  requireValue(
    ["03", "06", "09", "12"].includes(month.slice(5)),
    "SA reporting period is not a quarter",
  );
  const months = ["March", "June", "September", "December"];
  const endLabel = `${Number(period.slice(8))} ${months[Number(month.slice(5)) / 3 - 1]} ${month.slice(0, 4)}`;
  for (const [name, kind] of [
    ["Suburb", "suburb"],
    ["PC", "postcode"],
  ] as const) {
    const rows = sheet(sheets, name);
    requireValue(
      text(rows[13]?.[0]).includes(`- ${endLabel}, South Australia`),
      "SA reporting quarter changed",
    );
    requireValue(
      text(rows[8]?.[0]).includes("1 to 5") &&
        text(rows[9]?.[0]).includes("nearest 5"),
      "SA suppression convention changed",
    );
    const columns: { count: number; category: string }[] = [];
    for (const [start, type] of [
      [1, "Flat"],
      [11, "House"],
    ] as const) {
      requireValue(
        rows[14]?.[start] === (type === "Flat" ? "Flats/Units" : "Houses"),
        "SA dwelling schema changed",
      );
      for (let i = 0; i < 4; i++) {
        const c = start + i * 2,
          label = `${i + 1}${i === 3 ? "+" : ""} bedroom${i === 0 ? "" : "s"}`;
        requireValue(
          rows[15]?.[c] === label &&
            rows[16]?.[c] === "Count" &&
            rows[16]?.[c + 1] === "Median",
          "SA rent columns changed",
        );
        columns.push({
          count: c,
          category: `${type} ${i + 1}${i === 3 ? "+" : ""} bedrooms`,
        });
      }
    }
    for (const row of rows.slice(17)) {
      const name = text(row[0]);
      if (!name || / Total$/.test(name) || row.slice(1).every((v) => v == null))
        continue;
      requireValue(
        kind !== "postcode" || /^5\d{3}$/.test(name),
        "Invalid SA postcode",
      );
      const observations: LocalObservation[] = [];
      for (const { count, category } of columns) {
        const n = number(row[count]),
          v = number(row[count + 1]);
        if (row[count] == null && row[count + 1] == null) continue;
        requireValue(
          row[count] === "*" || (n !== null && Number.isInteger(n) && n >= 0),
          "Invalid SA count",
        );
        requireValue(
          row[count + 1] == null ||
            row[count + 1] === "*" ||
            (v !== null && v > 0 && v <= 10000),
          "Invalid SA median",
        );
        observations.push(rent(v, period, category, n, n !== null && n >= 15));
      }
      if (observations.length)
        areas.push({
          id: `sa:${kind}:${normaliseArea(name)}`,
          name,
          state: "SA",
          kind,
          boundaryVersion: "Publisher-defined geography",
          observations,
        });
    }
  }
  // Five source postcodes currently cross the Metro/Country grouping. Their
  // component medians cannot be averaged into a postcode median.
  const counts = new Map<string, number>();
  for (const a of areas) counts.set(a.id, (counts.get(a.id) ?? 0) + 1);
  const unique = areas.filter((a) => counts.get(a.id) === 1);
  return finish(unique, period, areas.length - unique.length);
}

type Group = { postcode: string; category: string; values: number[] };
function groupRent(
  groups: Map<string, Group>,
  postcode: string,
  category: string,
  value: number,
) {
  const key = `${postcode}:${category}`;
  const group = groups.get(key) ?? { postcode, category, values: [] };
  group.values.push(value);
  groups.set(key, group);
}
function grouped(
  groups: Map<string, Group>,
  state: "WA" | "TAS",
  period: string,
  excluded: number,
) {
  const areas = new Map<string, LocalArea>();
  for (const g of groups.values()) {
    g.values.sort((a, b) => a - b);
    const n = g.values.length;
    const value =
      (g.values[Math.floor((n - 1) / 2)]! + g.values[Math.floor(n / 2)]!) / 2;
    const area = areas.get(g.postcode) ?? {
      id: `${state.toLowerCase()}:postcode:${g.postcode}`,
      name: g.postcode,
      state,
      kind: "postcode",
      boundaryVersion: "Publisher postcodes",
      observations: [],
    };
    area.observations.push(rent(value, period, g.category, n, n >= 10));
    areas.set(g.postcode, area);
  }
  return finish([...areas.values()], period, excluded);
}

export function parseWaBonds(rows: string[][], month: string) {
  const period = monthEnd(month),
    groups = new Map<string, Group>();
  let excluded = 0;
  requireValue(
    JSON.stringify(rows[0]) ===
      JSON.stringify([
        "LODGEMENT DATE",
        "LOCALITY NAME",
        "POSTCODE",
        "WEEKLY RENT AMOUNT",
      ]),
    "WA lodgement columns changed",
  );
  const names = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  for (const row of rows.slice(1)) {
    if (row.every((v) => !v.trim())) continue;
    requireValue(row.length === 4, "WA lodgement row changed");
    const m = row[0]!.match(/^(\d{2})-([A-Z]{3})-(\d{2})$/);
    requireValue(
      m &&
        m[2] === names[Number(month.slice(5)) - 1] &&
        m[3] === month.slice(2, 4) &&
        Number(m[1]) >= 1 &&
        Number(m[1]) <= Number(period.slice(8)),
      "WA lodgement date does not match reporting month",
    );
    const postcode = text(row[2]),
      value = number(row[3]);
    if (
      !/^6\d{3}$/.test(postcode) ||
      value === null ||
      value <= 0 ||
      value > 10000
    ) {
      excluded++;
      continue;
    }
    groupRent(groups, postcode, "All dwellings", value);
  }
  return grouped(groups, "WA", period, excluded);
}

export function parseTasBonds(sheets: Sheet[], month: string) {
  const period = monthEnd(month),
    rows = sheet(sheets, "Active Bonds"),
    groups = new Map<string, Group>();
  let excluded = 0;
  requireValue(
    JSON.stringify(rows[1]) ===
      JSON.stringify([
        "Suburb",
        "State",
        "Postcode",
        "Bond Amount",
        "Weekly Rent",
        "Bond Lodgement date",
        "Bond Activation date",
        "Number of Bedrooms",
        "Dwelling / Premises Type",
        "Length of Tenancy (In Months)",
        "Housing Type",
      ]),
    "Tasmania active-bond schema changed",
  );
  const types: Record<string, string> = {
    "Separate House": "House",
    Unit: "Flat",
    Apartment: "Flat",
    Flat: "Flat",
    Townhouse: "Townhouse",
    "Semi-detached": "Semi-detached",
    Terrace: "Terrace",
  };
  for (const row of rows.slice(2)) {
    if (row.every((v) => v == null)) continue;
    requireValue(row[1] === "Tasmania", "Unexpected rental state");
    const date = row[5] instanceof Date ? row[5].toISOString() : text(row[5]);
    requireValue(
      date.startsWith(`${month}-`) && Number.isFinite(Date.parse(date)),
      "Tasmania lodgement date does not match reporting month",
    );
    const postcode = text(row[2]),
      value = number(row[4]),
      beds = number(row[7]),
      type = types[text(row[8])];
    if (
      row[10] !== "Private housing" ||
      !/^7\d{3}$/.test(postcode) ||
      value === null ||
      value <= 0 ||
      value > 10000 ||
      beds === null ||
      !Number.isInteger(beds) ||
      beds < 0 ||
      beds > 10 ||
      !type
    ) {
      excluded++;
      continue;
    }
    groupRent(groups, postcode, `${type} ${beds} bedrooms`, value);
  }
  return grouped(groups, "TAS", period, excluded);
}
