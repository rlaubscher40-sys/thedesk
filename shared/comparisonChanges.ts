import { MARKET_DIMENSIONS, type ComparisonRow, type MarketComparison } from "./marketComparison";

function normalise(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function comparisonPairKey(marketA: string, marketB: string): string {
  return JSON.stringify([normalise(marketA), normalise(marketB)].sort());
}

function edgeMarket(row: ComparisonRow | undefined, view: MarketComparison): string | null {
  if (!row || row.edge === "unclear") return null;
  return normalise(row.edge === "a" ? view.marketA : view.marketB);
}

function observations(row: ComparisonRow | undefined, view: MarketComparison): string {
  if (!row) return "";
  return JSON.stringify(
    (["a", "b"] as const)
      .map((side) => {
        const observation = side === "a" ? row.marketA : row.marketB;
        const source = view.sources.find((item) => item.ref === observation?.sourceRef);
        return [
          normalise(side === "a" ? view.marketA : view.marketB),
          observation
            ? {
                quote: normalise(observation.quote),
                href: source?.href ?? "",
                date: source?.date ?? "",
              }
            : null,
        ];
      })
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  );
}

export type ComparisonChanges = {
  sourceRecordsAdded: number;
  sourceRecordsRemoved: number;
  confidenceChanged: boolean;
  evidenceChanged: boolean;
  callChanged: boolean;
  dimensions: Array<{
    dimension: keyof typeof MARKET_DIMENSIONS;
    kind: "added" | "removed" | "updated";
    evidenceChanged: boolean;
    edgeChanged: boolean;
    before: string | null;
    after: string | null;
  }>;
};

/** Compare signed snapshots, not price movements. Wording/ref order and pair
 * orientation do not imply a market change. Selection changes are not new data. */
export function compareIntelligenceSnapshots(
  before: MarketComparison,
  after: MarketComparison
): ComparisonChanges | null {
  if (
    comparisonPairKey(before.marketA, before.marketB) !==
    comparisonPairKey(after.marketA, after.marketB)
  )
    return null;
  const previousSources = new Set(
    before.sources.map((source) => JSON.stringify([source.href, source.date]))
  );
  const currentSources = new Set(
    after.sources.map((source) => JSON.stringify([source.href, source.date]))
  );
  const sourceRecordsAdded = [...currentSources].filter((key) => !previousSources.has(key)).length;
  const sourceRecordsRemoved = [...previousSources].filter(
    (key) => !currentSources.has(key)
  ).length;
  const dimensions: ComparisonChanges["dimensions"] = [];
  for (const dimension of Object.keys(MARKET_DIMENSIONS) as Array<keyof typeof MARKET_DIMENSIONS>) {
    const a = before.rows.find((row) => row.dimension === dimension);
    const b = after.rows.find((row) => row.dimension === dimension);
    if (!a && !b) continue;
    const evidenceChanged = observations(a, before) !== observations(b, after);
    const edgeChanged = edgeMarket(a, before) !== edgeMarket(b, after);
    if (!evidenceChanged && !edgeChanged) continue;
    const label = (row: ComparisonRow | undefined, view: MarketComparison) =>
      !row || row.edge === "unclear" ? null : row.edge === "a" ? view.marketA : view.marketB;
    dimensions.push({
      dimension,
      kind: !a ? "added" : !b ? "removed" : "updated",
      evidenceChanged,
      edgeChanged,
      before: label(a, before),
      after: label(b, after),
    });
  }
  const confidenceChanged = before.confidence !== after.confidence;
  return {
    sourceRecordsAdded,
    sourceRecordsRemoved,
    confidenceChanged,
    evidenceChanged:
      sourceRecordsAdded > 0 ||
      sourceRecordsRemoved > 0 ||
      dimensions.some((row) => row.evidenceChanged),
    callChanged: confidenceChanged || dimensions.some((row) => row.edgeChanged),
    dimensions,
  };
}
