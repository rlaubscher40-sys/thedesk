import { useState } from "react";
import { Link } from "wouter";
import { comparisonPairKey } from "@shared/comparisonChanges";
import { useComparisonWatches } from "@/lib/useComparisonWatches";

export function ComparisonWatchlist() {
  const { watches, remove } = useComparisonWatches();
  const [error, setError] = useState("");
  if (!watches.length) return null;
  return (
    <section className="rule-hair rule-hair-b mt-6 py-4" aria-label="Saved market comparisons">
      <p className="bs-label-accent">Saved comparisons · this device</p>
      <p className="text-sm text-[var(--color-fg-muted)] mt-2">
        Open your saved read, then refresh when you want to check the evidence. No background checks
        or alerts.
      </p>
      <div className="mt-3 grid md:grid-cols-2 gap-x-8">
        {watches.map((watch) => {
          const key = comparisonPairKey(watch.marketA, watch.marketB);
          return (
            <div key={key} className="rule-hair py-3 flex items-start justify-between gap-4">
              <Link
                href={`/markets?q=${encodeURIComponent(watch.marketA)}&vs=${encodeURIComponent(watch.marketB)}`}
                className="bs-link font-serif text-lg"
              >
                {watch.marketA} <span className="text-[var(--color-accent-text)]">vs</span>{" "}
                {watch.marketB}
                <span className="bs-label block mt-1">
                  Baseline saved {watch.watchedAt.slice(0, 10)}
                </span>
              </Link>
              <button
                type="button"
                aria-label={`Remove saved comparison ${watch.marketA} vs ${watch.marketB}`}
                className="bs-label bs-link"
                onClick={() =>
                  setError(
                    remove(key) ? "" : "Could not remove this saved comparison on this device."
                  )
                }
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-sm mt-3">
          {error}
        </p>
      )}
    </section>
  );
}
