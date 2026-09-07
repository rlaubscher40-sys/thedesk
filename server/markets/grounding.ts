import {
  basisTextIsQuoted,
  comparisonQuality,
  evidenceFreshness,
} from "../../shared/comparisonQuality";
import {
  MARKET_DIMENSIONS,
  comparisonAnswerSchema,
  type MarketComparison,
} from "../../shared/marketComparison";
import { mentionsMarket, normaliseText, type MarketEvidence } from "./evidence";

function numericClaims(text: string): string[] {
  return [
    ...text.matchAll(
      /[$+-]?\d[\d,]*(?:\.\d+)?(?:\s*(?:%|percentage points?|basis points?|bps|million|billion|thousand|bn\b|[mkb]\b))?/gi
    ),
  ].map((match) => match[0].replace(/[,\s]/g, "").toLowerCase());
}
export function numbersGrounded(text: string, evidence: string): boolean {
  const values = new Set(numericClaims(evidence));
  return numericClaims(text).every((value) => values.has(value));
}

/** Invalid claims invalidate the whole view: never drop a row but keep its winning verdict. */
export function groundComparison(
  raw: unknown,
  sources: MarketEvidence[],
  marketA: string,
  marketB: string,
  now = Date.now()
): MarketComparison | null {
  const parsed = comparisonAnswerSchema.safeParse(raw);
  if (!parsed.success || parsed.data.rows.length === 0) return null;
  const result = parsed.data;
  const seen = new Set<string>();
  const refs = new Set<number>();
  for (const row of result.rows) {
    if (seen.has(row.dimension) || (!row.marketA && !row.marketB)) return null;
    seen.add(row.dimension);
    for (const side of ["a", "b"] as const) {
      const observation = side === "a" ? row.marketA : row.marketB;
      if (!observation) continue;
      const source = sources.find((item) => item.ref === observation.sourceRef);
      const quote = normaliseText(observation.quote);
      // Require a verbatim, market-naming passage. A national figure cannot silently
      // become local evidence, nor can Perth's figures be assigned to Brisbane.
      if (
        !source ||
        !source.markets.includes(side) ||
        !normaliseText(source.text).includes(quote) ||
        !mentionsMarket(quote, side === "a" ? marketA : marketB)
      )
        return null;
      if (
        observation.basis &&
        Object.values(observation.basis).some(
          (value) => value != null && !basisTextIsQuoted(value, quote)
        )
      )
        return null;
      observation.basis ??= null;
      refs.add(source.ref);
    }
    const quotes = [row.marketA?.quote, row.marketB?.quote].filter(Boolean).join(" ");
    if (!numbersGrounded(row.read, quotes)) return null;
  }
  // A comparison requires local evidence on both sides, even if no common dimension exists.
  if (!result.rows.some((row) => row.marketA) || !result.rows.some((row) => row.marketB))
    return null;
  const quotes = result.rows
    .flatMap((row) => [row.marketA?.quote ?? "", row.marketB?.quote ?? ""])
    .join(" ");
  if (
    ![result.verdict, result.deskTake, result.whatWouldChangeTheCall].every((text) =>
      numbersGrounded(text, quotes)
    )
  )
    return null;
  const selected = sources.filter((source) => refs.has(source.ref));
  const asOf = new Date(now).toISOString().slice(0, 10);
  let withheldEvidence = false;
  const rows = result.rows.map((row) => {
    const quality = comparisonQuality(row, selected, asOf);
    if (quality.comparable) return row;
    withheldEvidence = true;
    // Keep the grounded observations useful, but never retain a directional
    // interpretation or winning summary after its comparison basis fails.
    return {
      ...row,
      edge: "unclear" as const,
      read: "These observations provide context but do not establish a like-for-like advantage. Check the evidence gaps below.",
    };
  });
  const comparable = rows.filter((row) => comparisonQuality(row, selected, asOf).comparable);
  const allRecent = selected.every((source) => evidenceFreshness(source.date, asOf) === "recent");
  // Coverage volume is not a market score. In this first slice confidence is capped
  // at medium: Desk records have not been independently audited for comparability.
  const confidence =
    comparable.length >= 2 && allRecent && result.confidence !== "low" ? "medium" : "low";
  const edges = new Set(rows.filter((row) => row.edge !== "unclear").map((row) => row.edge));
  const hasEdge = edges.size > 0;
  const mixedEdges = edges.size > 1;
  const survivingMarket = edges.has("a") ? marketA : marketB;
  return {
    ...result,
    confidence,
    rows,
    verdict: !hasEdge
      ? "No clear edge on the available evidence."
      : mixedEdges
        ? "Different strengths. No clear overall edge."
        : withheldEvidence
          ? `A qualified edge for ${survivingMarket} on the comparable evidence.`
          : result.verdict,
    deskTake:
      mixedEdges || (hasEdge && withheldEvidence)
        ? `The retained advantages are limited to ${rows
            .filter((row) => row.edge !== "unclear")
            .map((row) => MARKET_DIMENSIONS[row.dimension].toLowerCase())
            .join(
              ", "
            )}. The wider market call remains open; unmatched evidence cannot establish an advantage.`
        : hasEdge
          ? result.deskTake
          : "The available local observations do not establish a comparable advantage. Read the dimension-level trade-offs and evidence gaps before forming a market preference.",
    marketA,
    marketB,
    asOf,
    sources: selected.map(({ text: _text, ...source }) => source),
  };
}
