import {
  STATE_CODES,
  normaliseArea,
  type LocalArea,
  type LocalObservation,
} from "../../shared/localData";

export type Sheet = { sheet: string; data: unknown[][] };
const text = (v: unknown) =>
  typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  return typeof v === "string" && /^-?\d+(?:\.\d+)?$/.test(v.trim())
    ? Number(v)
    : null;
}
function integer(v: unknown): number | null {
  const n = num(v);
  return n !== null && Number.isSafeInteger(n) ? n : null;
}
function sheet(sheets: Sheet[], name: string): unknown[][] {
  const matches = sheets.filter((s) => s.sheet.trim() === name);
  if (matches.length !== 1)
    throw new Error(`Missing or duplicate worksheet: ${name}`);
  return matches[0]!.data;
}
function requireValue(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

export function parseLocalPopulation(sheets: Sheet[], year: number) {
  requireValue(
    Number.isInteger(year) && year >= 2022 && year <= 2100,
    "Invalid population year",
  );
  const areas: LocalArea[] = [];
  const ids = new Set<string>();
  for (let stateIndex = 0; stateIndex < 8; stateIndex++) {
    const rows = sheet(sheets, `Table ${stateIndex + 1}`);
    requireValue(
      text(rows[1]?.[0]).includes("Statistical Areas Level 2"),
      "Unexpected population geography",
    );
    requireValue(
      text(rows[2]?.[0]) ===
        `Regional population, ${year - 1}–${String(year).slice(-2)}`,
      "Unexpected population reporting year",
    );
    requireValue(
      rows[4]?.[8] === year - 1 &&
        rows[4]?.[9] === year &&
        rows[5]?.[6] === "SA2 code" &&
        rows[5]?.[7] === "SA2 name",
      "Population schema changed",
    );
    requireValue(
      rows[4]?.[12] === "Natural increase" &&
        rows[4]?.[13] === "Net internal migration" &&
        rows[4]?.[14] === "Net overseas migration",
      "Population components changed",
    );
    let total = 0,
      records = 0;
    for (const row of rows.slice(6)) {
      const code = text(row[6]);
      if (!/^\d{9}$/.test(code)) continue;
      requireValue(
        code[0] === String(stateIndex + 1) && !ids.has(code),
        "Duplicate or wrong-state population area",
      );
      ids.add(code);
      const current = integer(row[9]),
        previous = integer(row[8]),
        change = integer(row[10]);
      const natural = integer(row[12]),
        internal = integer(row[13]),
        overseas = integer(row[14]);
      requireValue(
        current !== null &&
          current >= 0 &&
          previous !== null &&
          previous >= 0 &&
          change !== null &&
          natural !== null &&
          internal !== null &&
          overseas !== null,
        "Missing population count",
      );
      requireValue(
        current - previous === change &&
          natural + internal + overseas === change,
        "Population counts do not reconcile",
      );
      const growth = num(row[11]);
      requireValue(growth !== null, "Missing population growth");
      total += current;
      records++;
      const period = `${year}-06-30`;
      const observation = (
        measure: LocalObservation["measure"],
        value: number,
        unit: LocalObservation["unit"],
        at = period,
      ): LocalObservation => ({
        measure,
        value,
        unit,
        period: at,
        category: "All residents",
        sample: null,
        status: "published",
      });
      areas.push({
        id: `ABS:SA2:2021:${code}`,
        name: text(row[7]),
        state: STATE_CODES[stateIndex]!,
        kind: "SA2",
        boundaryVersion: "ASGS Edition 3 (2021)",
        observations: [
          observation("population", current, "people"),
          observation("population", previous, "people", `${year - 1}-06-30`),
          observation("population-change", change, "people"),
          observation("population-growth", growth, "%"),
          observation("natural-increase", natural, "people"),
          observation("internal-migration", internal, "people"),
          observation("overseas-migration", overseas, "people"),
        ],
      });
    }
    const totals = rows.filter((row) => /^Total /.test(text(row[7])));
    requireValue(
      records > 0 && totals.length === 1 && integer(totals[0]![9]) === total,
      "Population state total does not reconcile",
    );
  }
  return { period: `${year}-06-30`, areas, excludedRows: 0 };
}

export function parseNswBonds(sheets: Sheet[], month: string) {
  requireValue(/^\d{4}-(0[1-9]|1[0-2])$/.test(month), "Invalid NSW month");
  const candidates = sheets.filter(
    (s) =>
      s.data[2]?.slice(0, 5).join("|") ===
      "Lodgement Date|Postcode|Dwelling Type|Bedrooms|Weekly Rent",
  );
  requireValue(candidates.length === 1, "NSW bond schema changed");
  const rows = candidates[0]!.data;
  const expected = new Date(`${month}-01T00:00:00Z`).toLocaleDateString(
    "en-AU",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
  requireValue(
    text(rows[0]?.[0]).replace(/\s+/g, " ").includes(expected),
    "NSW bond reporting month mismatch",
  );
  const groups = new Map<
    string,
    { postcode: string; category: string; rents: number[] }
  >();
  let excludedRows = 0;
  const dwelling: Record<string, string> = {
    F: "Flat/unit",
    H: "House",
    T: "Terrace/townhouse/semi-detached",
  };
  for (const row of rows.slice(3)) {
    if (row.every((v) => v == null || v === "")) continue;
    requireValue(
      row[0] instanceof Date &&
        Number.isFinite(row[0].getTime()) &&
        row[0].toISOString().slice(0, 7) === month,
      "NSW bond date outside reporting month",
    );
    const postcode = text(row[1]),
      type = dwelling[text(row[2])],
      beds = integer(row[3]),
      rent = num(row[4]);
    if (
      !/^\d{4}$/.test(postcode) ||
      !type ||
      beds === null ||
      beds < 0 ||
      beds > 20 ||
      rent === null ||
      rent <= 0 ||
      rent > 100_000
    ) {
      excludedRows++;
      continue;
    }
    const category = `${type} · ${beds} bedrooms`;
    const key = `${postcode}:${category}`;
    const group = groups.get(key) ?? { postcode, category, rents: [] };
    group.rents.push(rent);
    groups.set(key, group);
  }
  const areaMap = new Map<string, LocalArea>();
  for (const group of groups.values()) {
    const { postcode, category, rents } = group;
    rents.sort((a, b) => a - b);
    const mid = Math.floor(rents.length / 2);
    const value =
      rents.length < 10
        ? null
        : rents.length % 2
          ? rents[mid]!
          : (rents[mid - 1]! + rents[mid]!) / 2;
    const area =
      areaMap.get(postcode) ??
      ({
        id: `NSW:postcode:${postcode}`,
        name: postcode,
        state: "NSW",
        kind: "postcode",
        boundaryVersion: "Publisher postcode at lodgement",
        observations: [],
      } as LocalArea);
    area.observations.push({
      measure: "weekly-rent",
      value,
      unit: "AUD/week",
      period: new Date(
        Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0),
      )
        .toISOString()
        .slice(0, 10),
      category,
      sample: rents.length,
      status: value === null ? "insufficient-sample" : "published",
    });
    areaMap.set(postcode, area);
  }
  requireValue(areaMap.size > 0, "No NSW rent groups");
  return {
    period: new Date(
      Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0),
    )
      .toISOString()
      .slice(0, 10),
    areas: [...areaMap.values()],
    excludedRows,
  };
}

const QLD_TABLES = [
  ["1 pc-rents", "2 pc-new-bonds", "Postcode", "postcode"],
  ["4 sub-rents", "5 sub-new-bonds", "Suburb", "suburb"],
  ["7 lga-rents", "8 lga-new-bonds", "Local Government Area", "LGA"],
] as const;
function qldPeriods(rows: unknown[][]) {
  const quarters: Record<string, string> = {
    Mar: "03",
    Jun: "06",
    Sep: "09",
    Dec: "12",
  };
  return (rows[5] ?? []).flatMap((month, index) => {
    const mm = quarters[text(month)],
      year = integer(rows[6]?.[index]);
    return mm && year && year >= 2010
      ? [
          {
            index,
            period: new Date(Date.UTC(year, Number(mm), 0))
              .toISOString()
              .slice(0, 10),
          },
        ]
      : [];
  });
}
export function parseQldBonds(sheets: Sheet[]) {
  requireValue(
    sheet(sheets, "Contents").some((row) =>
      row.some(
        (v) => text(v) === "https://creativecommons.org/licenses/by/4.0/",
      ),
    ),
    "Queensland workbook licence changed",
  );
  const areas: LocalArea[] = [];
  let period = "";
  for (const [rentsName, countName, column, kind] of QLD_TABLES) {
    const rows = sheet(sheets, rentsName),
      counts = sheet(sheets, countName);
    requireValue(
      rows[4]?.[2] === column &&
        rows[4]?.[3] === "Dwelling" &&
        counts[4]?.[2] === column &&
        counts[4]?.[3] === "Dwelling",
      "Queensland rent schema changed",
    );
    const periods = qldPeriods(rows),
      countPeriods = qldPeriods(counts);
    requireValue(
      periods.length > 0 &&
        JSON.stringify(periods) === JSON.stringify(countPeriods),
      "Queensland rent/count periods differ",
    );
    const latest = periods.at(-1)!;
    requireValue(
      !period || latest.period === period,
      "Queensland geographic periods differ",
    );
    period = latest.period;
    const prior = `${Number(period.slice(0, 4)) - 1}${period.slice(4)}`;
    const selected = periods.filter(
      (p) => p.period === period || p.period === prior,
    );
    const countMap = new Map<string, unknown[]>();
    for (const row of counts.slice(8)) {
      if (!text(row[2]) || !/^(Flat|House|Townhouse) \d/.test(text(row[3])))
        continue;
      const key = `${normaliseArea(text(row[2]))}:${text(row[3])}`;
      requireValue(!countMap.has(key), "Duplicate Queensland bond count");
      countMap.set(key, row);
    }
    const areaMap = new Map<string, LocalArea>(),
      seen = new Set<string>();
    for (const row of rows.slice(8)) {
      if (!text(row[2]) || !/^(Flat|House|Townhouse) \d/.test(text(row[3])))
        continue;
      const name = text(row[2]),
        category = text(row[3]),
        id = `QLD:${kind}:${normaliseArea(name)}`,
        key = `${normaliseArea(name)}:${category}`;
      requireValue(!seen.has(key), "Duplicate Queensland rent");
      seen.add(key);
      const area =
        areaMap.get(id) ??
        ({
          id,
          name,
          state: "QLD",
          kind,
          boundaryVersion: "RTA source geography; no ABS crosswalk assumed",
          observations: [],
        } as LocalArea);
      for (const p of selected) {
        const value = num(row[p.index]),
          count = integer(countMap.get(key)?.[p.index]);
        requireValue(
          value === null || (value > 0 && value <= 100_000),
          "Invalid Queensland rent",
        );
        requireValue(
          count === null || count >= 0,
          "Invalid Queensland bond count",
        );
        area.observations.push({
          measure: "weekly-rent",
          value,
          unit: "AUD/week",
          period: p.period,
          category,
          sample: count,
          status: value === null ? "suppressed" : "published",
        });
      }
      areaMap.set(id, area);
    }
    requireValue(areaMap.size > 0, "No Queensland areas");
    areas.push(...areaMap.values());
  }
  return { period, areas, excludedRows: 0 };
}
