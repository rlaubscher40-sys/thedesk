import snapshot from "./data/nhsac-housing-balance-2026.json";

export const HOUSING_BALANCE_SNAPSHOT = snapshot;
export type HousingBalanceSnapshot = typeof snapshot;
const date = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

/** Match flows, units, vintage and geography before calculating a balance.
 * Demand is the Council's estimate of additional dwellings needed, not people
 * divided by an assumed household size, approvals, a target or a waiting list. */
export function matchedHousingBalance(data: HousingBalanceSnapshot | null | undefined) {
  if (
    !data ||
    data.id !== snapshot.id ||
    data.sourceUrl !== snapshot.sourceUrl ||
    data.sourceSha256 !== snapshot.sourceSha256 ||
    data.publishedAt !== snapshot.publishedAt ||
    data.pdfPage !== snapshot.pdfPage ||
    data.printedPage !== snapshot.printedPage ||
    data.report !== snapshot.report ||
    data.publisher !== snapshot.publisher ||
    !date(data.verifiedAt) ||
    data.verifiedAt < data.publishedAt ||
    data.observations.length !== 3
  )
    return null;
  const names = ["grossCompletions", "netNewSupply", "newUnderlyingDemand"];
  if (new Set(data.observations.map((r) => r.measure)).size !== 3) return null;
  for (const row of data.observations) {
    if (
      row.value !== snapshot.observations.find((r) => r.measure === row.measure)?.value ||
      !names.includes(row.measure) ||
      row.scope !== "Australia" ||
      row.unit !== "dwellings" ||
      row.start !== "2024-07-01" ||
      row.end !== "2025-12-31" ||
      !date(row.start) ||
      !date(row.end) ||
      row.end >= data.publishedAt ||
      row.approximate !== true ||
      row.basis !==
        (row.measure === "grossCompletions" ? "reported-completions" : "historical-estimate") ||
      !Number.isSafeInteger(row.value) ||
      row.value < 0 ||
      row.value > 999999 ||
      row.value % 1000 !== 0
    )
      return null;
  }
  const value = (measure: string) => data.observations.find((r) => r.measure === measure)!.value;
  const gross = value("grossCompletions"),
    net = value("netNewSupply"),
    demand = value("newUnderlyingDemand");
  if (net > gross || demand <= 0) return null;
  return {
    scope: "Australia" as const,
    start: "2024-07-01",
    end: "2025-12-31",
    period: "July 2024 to December 2025",
    gross,
    net,
    demand,
    netBalance: net - demand,
    shortfall: Math.max(0, demand - net),
    netPer100: Math.round((net / demand) * 100),
    impliedRemovals: gross - net,
    publishedAt: data.publishedAt,
    source: `${data.sourceUrl}#page=${data.pdfPage}`,
  };
}
export type HousingBalance = NonNullable<ReturnType<typeof matchedHousingBalance>>;
