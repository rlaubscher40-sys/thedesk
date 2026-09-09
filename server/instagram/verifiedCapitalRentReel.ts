import { createHash } from "node:crypto";
import {
  RENT_CITIES,
  latestRent,
  rentIsOlder,
  rentPeriod,
  type CityRents,
} from "../../shared/cityRents";
import type { ReelStat } from "../video/statReel";
import type { ScriptLine } from "../video/narration";
import { buildReelCaption } from "./reelCaption";

/** Eight matching capital-city observations, not a national average or state proxy. */
export function verifiedCapitalRentReel(data: CityRents, now = new Date()) {
  if (!Number.isFinite(now.getTime()) || data.status !== "available" || !data.retrievedAt)
    return null;
  const retrieved = Date.parse(data.retrievedAt);
  // Fetching can finish just after the scheduler's fixed start time.
  if (
    !Number.isFinite(retrieved) ||
    retrieved > now.getTime() + 60_000 ||
    now.getTime() - retrieved > 86_400_000
  )
    return null;
  const asOf = now.toISOString();
  const seen = new Set<string>();
  for (const row of data.observations) {
    const key = `${row.city}/${row.period}`;
    if (
      !RENT_CITIES.some((city) => city === row.city) ||
      seen.has(key) ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period) ||
      row.period >= asOf.slice(0, 7) ||
      !["", "p", "r"].includes(row.status) ||
      !Number.isFinite(row.annualPercent) ||
      row.annualPercent < -100 ||
      // This format displays the one-decimal ABS series. Never hide a
      // finer-precision difference behind an apparently tied displayed rate.
      Math.abs(row.annualPercent * 10 - Math.round(row.annualPercent * 10)) > 1e-8
    )
      return null;
    seen.add(key);
  }
  const rows = RENT_CITIES.map((city) => latestRent(data, city));
  const reference = rows[0]?.period;
  if (!reference || rows.some((row) => !row || row.period !== reference || rentIsOlder(row, asOf)))
    return null;
  const evidenceRows = rows.map((row) => row!);
  const high = Math.max(...evidenceRows.map((row) => row.annualPercent));
  const low = Math.min(...evidenceRows.map((row) => row.annualPercent));
  const figure = (high - low).toFixed(1);
  const period = rentPeriod(reference);
  const highest = evidenceRows.filter((row) => row.annualPercent === high);
  const lowest = evidenceRows.filter((row) => row.annualPercent === low);
  const endpoint = (group: typeof evidenceRows, word: string) =>
    group.length === 1 ? `${group[0]!.city} · ${word}` : `${group.length} capitals tied ${word}`;
  const level = high === low;
  const stat: ReelStat = {
    label: "Eight-capital rent growth",
    value: `${figure}pp`,
    line: level
      ? "All eight have the same annual change."
      : "Gap between highest and lowest annual changes.",
    subtext: `Year to ${period} · Not a national average`,
    source: `ABS CPI rents · Year to ${period}`,
    facts: level
      ? [
          { figure: `${high.toFixed(1)}%`, caption: "Annual rent change · all eight capitals" },
          { figure: "Explore data", caption: "Bio / Markets" },
        ]
      : [
          { figure: `${high.toFixed(1)}%`, caption: endpoint(highest, "highest") },
          { figure: `${low.toFixed(1)}%`, caption: endpoint(lowest, "lowest") },
          { figure: "Explore data", caption: "Bio / Markets" },
        ],
  };
  const script: ScriptLine[] = [
    { key: "label", text: "Are rents changing at the same pace across our capitals?" },
    {
      key: "value",
      text: level
        ? "This month, all eight share the same annual change."
        : `The gap is ${figure} percentage points.`,
    },
    { key: "line", text: "That's the range across eight cities, not an Australian average." },
    {
      key: "claim",
      text: `Year to ${period}. It measures changes in rents paid, not dollar rents.`,
    },
    { key: "facts", text: "So a higher rate doesn't mean a more expensive city." },
    { key: "signOff", text: "Find your capital's figure. Bio, then Markets." },
  ];
  const evidence = {
    series: "ABS:CPI(2.0.0)/3.30014.10.1+2+3+4+5+6+7+8.M/PCT",
    rows: evidenceRows,
  };
  return {
    stat,
    script,
    publication: { key: "instagram-reel-abs-rents-eight-capitals-v1", date: `${reference}-01` },
    evidenceHash: createHash("sha256").update(JSON.stringify(evidence)).digest("hex"),
    caption: buildReelCaption({
      hook: "Are rents changing at the same pace across our capitals?",
      finding:
        `Year to ${period}: ${figure} percentage points between highest and lowest annual rent changes.\n` +
        evidenceRows
          .map(
            (row) =>
              `${row.city}: ${row.annualPercent.toFixed(1)}%${row.status === "r" ? " (revised)" : row.status === "p" ? " (provisional)" : ""}`
          )
          .join("\n"),
      meaning:
        "The range is not a national average or a state/regional estimate. Higher rent growth doesn't establish higher dollar rents, yields or a better investment, or explain why rents changed.",
      method: "Source: ABS CPI rents actually paid, original capital-city series.",
      revisions: "Revision flags shown above where present. Data can be revised.",
      action:
        "Share this with someone comparing rent levels and growth—they measure different things.",
      read: "capitalRents",
    }),
  };
}
