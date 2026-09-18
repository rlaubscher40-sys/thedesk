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
              {change.evidenceChanged && (
                <details className="mt-3">
                  <summary className="bs-link cursor-pointer">
                    Inspect the saved and current evidence
                  </summary>
                  {[
                    { label: "Saved", view: baseline },
                    { label: "Current", view: current },
                  ].map(({ label, view }) => {
                    const row = view.rows.find((item) => item.dimension === change.dimension);
                    return (
                      <div key={label} className="mt-4">
                        <h4 className="bs-label">
                          {label} · {view.asOf}
                        </h4>
                        {(["a", "b"] as const).map((side) => {
                          const observation = side === "a" ? row?.marketA : row?.marketB;
                          const source = view.sources.find(
                            (item) => item.ref === observation?.sourceRef
                          );
                          return (
                            <div key={side} className="mt-3">
                              <strong>{side === "a" ? view.marketA : view.marketB}</strong>
                              <p className="leading-6">
                                {observation?.quote ?? "No supported observation."}
                              </p>
                              {source && (
                                <a className="bs-link underline text-sm" href={source.href}>
                                  {source.publisher ?? source.title} · {source.date}
                                </a>
                              )}
                              {observation && (
                                <p className="text-xs mt-2 leading-5">
                                  Basis:{" "}
                                  {observation.basis
                                    ? Object.entries(observation.basis)
                                        .map(
                                          ([key, value]) => `${key}: ${value ?? "not established"}`
                                        )
                                        .join(" · ")
                                    : "not recorded in this older snapshot"}
                                  . A change in period or basis is not a like-for-like market
                                  movement.
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </details>
              )}
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
