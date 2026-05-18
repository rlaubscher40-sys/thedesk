/**
 * Shared metric-trend utilities.
 *
 * Every metric tile on the site interprets a current/prior pair into a
 * direction (up/down/flat) and then into a sentiment (good/bad/neutral)
 * based on which direction is favourable for the partner channel. The
 * tone is rendered as an arrow icon + delta in green / red / amber.
 */

export type Trend = "up" | "down" | "flat";
export type Sentiment = "good" | "bad" | "neutral";

/**
 * Direction-of-good lookup. Defaults to "neutral" so unrecognised
 * metric labels render in the muted amber rather than mis-coloured.
 *
 *   · Rates / costs / risk metrics, DOWN is good.
 *   · Activity / income / channel / index metrics, UP is good.
 *   · Anything else, neutral.
 */
export function directionOfGood(label: string): "up" | "down" | "neutral" {
  const k = label.toLowerCase();
  if (/(cash rate|rate|inflation|cpi|unemploy|oil|brent|vix|spread)/.test(k))
    return "down";
  if (
    /(clearance|asx|index|channel|broker|wage|income|gdp|production|housing|listings|prod)/.test(
      k
    )
  )
    return "up";
  return "neutral";
}

export function computeSentiment(
  trend: Trend,
  dog: "up" | "down" | "neutral"
): Sentiment {
  if (trend === "flat" || dog === "neutral") return "neutral";
  if (trend === dog) return "good";
  return "bad";
}

/** Sentiment → CSS colour string. Centralised so every chip matches. */
export const SENTIMENT_COLOUR: Record<Sentiment, string> = {
  good: "oklch(0.72 0.17 155)", // emerald
  bad: "oklch(0.68 0.20 15)", // rose
  neutral: "oklch(0.78 0.18 70)", // amber
};

export function toMetricNumber(v: string | number | undefined | null): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return NaN;
  const m = v.match(/-?[\d,.]+/);
  if (!m) return NaN;
  return Number(m[0].replace(/,/g, ""));
}

/** Tight numeric format suited for metric tiles. */
export function formatMetricDelta(d: number): string {
  const abs = Math.abs(d);
  if (abs >= 100) return d.toFixed(0);
  if (abs >= 1) return d.toFixed(2);
  return d.toFixed(3);
}

/** Resolve everything a tile needs to render in one call. */
export function resolveMetricTrend(
  label: string,
  current: string | number | undefined,
  prior: string | number | undefined | null
) {
  const curN = toMetricNumber(current);
  const priN = prior != null ? toMetricNumber(prior) : NaN;
  const hasDelta = Number.isFinite(curN) && Number.isFinite(priN);
  const delta = hasDelta ? curN - priN : 0;
  const trend: Trend = !hasDelta || Math.abs(delta) < 0.0001
    ? "flat"
    : delta > 0
      ? "up"
      : "down";
  const dog = directionOfGood(label);
  const sentiment = computeSentiment(trend, dog);
  return {
    hasDelta,
    delta,
    trend,
    sentiment,
    colour: SENTIMENT_COLOUR[sentiment],
  };
}
