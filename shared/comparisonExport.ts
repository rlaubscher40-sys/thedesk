import { DEFAULT_SITE_URL } from "./const";
import { MARKET_DIMENSIONS, type MarketComparison } from "./marketComparison";
import { COMPARISON_BASIS_LABELS, comparisonQuality } from "./comparisonQuality";

/** A portable source trail for the existing verified comparison, never a new generated answer. */
export function comparisonResearchText(view: MarketComparison, token: string): string {
  const supported = new Set(view.rows.map((row) => row.dimension));
  const lines = [
    `The Desk — ${view.marketA} vs ${view.marketB}`,
    `Saved evidence snapshot: ${view.asOf}. Not a live market update.`,
    `Evidence confidence: ${view.confidence}.`,
    `Signed source trail: ${DEFAULT_SITE_URL}/brief?t=${encodeURIComponent(token)}`,
    "",
    view.verdict,
    "",
    view.deskTake,
    "",
    "Evidence and comparison limits",
    "A directional call requires compatible measures, observation periods, property/population types, geography levels and units. Matching recorded criteria do not certify identical research methods.",
  ];
  for (const row of view.rows) {
    const quality = comparisonQuality(row, view.sources, view.asOf);
    lines.push(
      "",
      MARKET_DIMENSIONS[row.dimension],
      quality.comparable
        ? "Recorded comparison criteria match."
        : `Not directly comparable: ${quality.reasons.join("; ")}`,
      row.read
    );
    for (const side of ["a", "b"] as const) {
      const observation = side === "a" ? row.marketA : row.marketB;
      lines.push(
        `${side === "a" ? view.marketA : view.marketB}: ${observation?.quote ?? "No supported observation."}`
      );
      if (!observation) continue;
      for (const key of Object.keys(COMPARISON_BASIS_LABELS) as Array<
        keyof typeof COMPARISON_BASIS_LABELS
      >)
        lines.push(
          `  ${COMPARISON_BASIS_LABELS[key]}: ${observation.basis?.[key] ?? "not established"}`
        );
      const source = view.sources.find((item) => item.ref === observation.sourceRef);
      if (source)
        lines.push(
          `  Source: ${source.publisher ?? source.title} — ${source.title}`,
          `  ${source.dateKind === "observation" ? "Observation period" : "Publication date"}: ${source.date}`,
          `  ${DEFAULT_SITE_URL}${source.href}`
        );
    }
  }
  const gaps = Object.entries(MARKET_DIMENSIONS)
    .filter(([key]) => !supported.has(key as keyof typeof MARKET_DIMENSIONS))
    .map(([, label]) => label);
  lines.push(
    "",
    `Unsupported dimensions: ${gaps.join(", ") || "none omitted"}.`,
    "",
    "What would change the call",
    view.whatWouldChangeTheCall,
    "",
    "Changes in selected evidence or interpretation are not measured price movements. Device-local watches do not create alerts. This export does not update itself."
  );
  return lines.join("\n") + "\n";
}
