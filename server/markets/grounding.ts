import { comparisonAnswerSchema, type MarketComparison } from "../../shared/marketComparison";
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
export function isRecentEvidence(date: string, now: number): boolean {
  const age = now - Date.parse(date);
  return Number.isFinite(age) && age >= 0 && age <= 180 * 24 * 60 * 60 * 1000;
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
      refs.add(source.ref);
    }
    const quotes = [row.marketA?.quote, row.marketB?.quote].filter(Boolean).join(" ");
    if (!numbersGrounded(row.read, quotes)) return null;
    if (
      row.edge !== "unclear" &&
      (!row.marketA ||
        !row.marketB ||
        ![row.marketA, row.marketB].every((item) =>
          isRecentEvidence(sources.find((source) => source.ref === item.sourceRef)?.date ?? "", now)
        ))
    )
      return null;
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
  const comparable = result.rows.filter((row) => row.marketA && row.marketB);
  const allRecent = selected.every((source) => isRecentEvidence(source.date, now));
  // Coverage volume is not a market score. In this first slice confidence is capped
  // at medium: Desk records have not been independently audited for comparability.
  const confidence =
    comparable.length >= 2 && allRecent && result.confidence !== "low" ? "medium" : "low";
  const hasEdge = result.rows.some((row) => row.edge !== "unclear");
  return {
    ...result,
    confidence,
    verdict: hasEdge ? result.verdict : "No clear edge on the available evidence.",
    deskTake: hasEdge
      ? result.deskTake
      : "The available local observations do not establish a comparable advantage. Read the dimension-level trade-offs and evidence gaps before forming a market preference.",
    marketA,
    marketB,
    asOf: new Date(now).toISOString().slice(0, 10),
    sources: selected.map(({ text: _text, ...source }) => source),
  };
}
