import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { comparisonPairKey } from "@shared/comparisonChanges";
import type { MarketComparison } from "@shared/marketComparison";
import { useComparisonWatches } from "@/lib/useComparisonWatches";
import { trackEvent } from "@/lib/analytics";

export function ComparisonWatchButton({
  comparison,
  token,
}: {
  comparison: MarketComparison;
  token: string;
}) {
  const { watches, save } = useComparisonWatches();
  const [message, setMessage] = useState("");
  const key = comparisonPairKey(comparison.marketA, comparison.marketB);
  const watched = watches.find((watch) => comparisonPairKey(watch.marketA, watch.marketB) === key);
  function remember(replace: boolean) {
    const result = save(
      {
        marketA: comparison.marketA,
        marketB: comparison.marketB,
        baselineToken: token,
        watchedAt: new Date().toISOString(),
      },
      replace
    );
    setMessage(
      result.ok
        ? replace
          ? "Saved baseline updated."
          : "Comparison saved on this device."
        : (result.message ?? "Could not save comparison.")
    );
    if (result.ok)
      trackEvent(
        replace ? "comparison_baseline_reset" : "comparison_watch",
        window.location.pathname === "/brief" ? "brief" : "markets"
      );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="bs-btn bs-btn-outline inline-flex items-center gap-2"
        disabled={Boolean(watched)}
        onClick={() => remember(false)}
      >
        {watched ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
        {watched ? "Comparison saved" : "Save comparison"}
      </button>
      {watched && watched.baselineToken !== token && (
        <button type="button" onClick={() => remember(true)} className="bs-label bs-link">
          Use this read as my baseline
        </button>
      )}
      {message && (
        <p role="status" className="text-sm text-[var(--color-fg-muted)]">
          {message}
        </p>
      )}
    </div>
  );
}
