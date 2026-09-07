import { compareIntelligenceSnapshots } from "@shared/comparisonChanges";
import { MARKET_DIMENSIONS, type MarketComparison } from "@shared/marketComparison";

export function ComparisonChangeSummary({
  baseline,
  current,
}: {
  baseline: MarketComparison;
  current: MarketComparison;
}) {
  const changes = compareIntelligenceSnapshots(baseline, current);
  if (!changes) return null;
  const unchanged = !changes.evidenceChanged && !changes.callChanged;
  return (
    <section className="rule-major mt-8 py-5" aria-label="Changes since saved baseline">
      <p className="bs-label-accent">
        Since your saved read · {baseline.asOf} → {current.asOf}
      </p>
      <h3 className="font-serif text-2xl mt-3">
        {unchanged
          ? "No change in selected evidence, directional edges or confidence."
          : changes.evidenceChanged
            ? "The evidence selected for this brief has changed."
            : "The interpretation changed; the selected evidence did not."}
      </h3>
      <p className="text-sm leading-6 text-[var(--color-fg-muted)] mt-3">
        This compares two intelligence snapshots, not market prices. Different source selections or
        a different interpretation do not prove that the market itself moved.
      </p>
      {(changes.sourceRecordsAdded > 0 || changes.sourceRecordsRemoved > 0) && (
        <p className="bs-label mt-4">
          Source records in this brief: {changes.sourceRecordsAdded} added ·{" "}
          {changes.sourceRecordsRemoved} no longer selected
        </p>
      )}
      {changes.confidenceChanged && (
        <p className="text-sm mt-3">
          Evidence confidence: {baseline.confidence} → {current.confidence}
        </p>
      )}
      {changes.dimensions.length > 0 && (
        <ul className="mt-4 space-y-3">
          {changes.dimensions.map((change) => (
            <li key={change.dimension} className="rule-hair pt-3">
              <p className="bs-label-accent">{MARKET_DIMENSIONS[change.dimension]}</p>
              <p className="text-sm mt-1">
                {change.kind === "added"
                  ? "New dimension in this brief."
                  : change.kind === "removed"
                    ? "Not supported in the refreshed brief."
                    : change.evidenceChanged
                      ? "Quoted evidence changed."
                      : "Directional interpretation changed."}
              </p>
              {change.edgeChanged && (
                <p className="font-serif text-lg mt-1">
                  {change.before ?? "No clear edge"} → {change.after ?? "No clear edge"}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
