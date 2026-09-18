import snapshot from "./analysis/rent-pressure-2026-07.json";
import { RENT_CITIES, type RentObservation } from "./cityRents";
export const RENT_PRESSURE_RELEASE = {
  id: "2026-07",
  publishedOn: "2026-09-18",
  sourceReleasedOn: "2026-08-26",
  sourceUrl: snapshot.sourceUrl,
  retrievedAt: snapshot.retrievedAt,
  workbookSha256: snapshot.workbookSha256,
  observations: snapshot.observations as RentObservation[],
  history: [
    {
      date: "2026-09-18",
      note: "First edition. July and June 2026 observations extracted from the July ABS Table 11 workbook. Original annual rent-change series; method version 1.",
    },
  ],
};
/** Compare successive annual rates, never infer monthly rent change or rent levels. */
export function analyseRentPressure(observations: RentObservation[], period: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)) return null;
  const date = new Date(`${period}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  const priorPeriod = date.toISOString().slice(0, 7);
  const rows = RENT_CITIES.map((city) => {
    const current = observations.filter((row) => row.city === city && row.period === period);
    const prior = observations.filter((row) => row.city === city && row.period === priorPeriod);
    if (current.length !== 1 || prior.length !== 1) return null;
    if (
      ![current[0]!, prior[0]!].every(
        (row) =>
          Number.isFinite(row.annualPercent) &&
          row.annualPercent >= -100 &&
          ["", "p", "r"].includes(row.status)
      )
    )
      return null;
    return {
      city,
      current: current[0]!,
      prior: prior[0]!,
      change: Math.round((current[0]!.annualPercent - prior[0]!.annualPercent) * 10) / 10,
    };
  });
  if (rows.some((row) => row === null)) return null;
  const complete = rows.filter((row) => row !== null);
  const spread = (values: number[]) =>
    Math.round((Math.max(...values) - Math.min(...values)) * 10) / 10;
  return {
    period,
    priorPeriod,
    rows: complete,
    faster: complete.filter((row) => row.change > 0).length,
    slower: complete.filter((row) => row.change < 0).length,
    unchanged: complete.filter((row) => row.change === 0).length,
    positive: complete.filter((row) => row.current.annualPercent > 0).length,
    spread: spread(complete.map((row) => row.current.annualPercent)),
    priorSpread: spread(complete.map((row) => row.prior.annualPercent)),
  };
}
