/**
 * The three broadsheet chart primitives.
 *
 * All hand-rolled inline SVG: no chart library, no fills under lines, no
 * axes beyond a couple of guide rules and mono tick labels. The redesign
 * treats a chart as a typographic element, so these are deliberately
 * closer to a rule-and-label system than to a plotting toolkit.
 *
 *   · <StepChart>       the cash-rate path, a stepped accent polyline
 *   · <MetricSparkline> a metric's 30-day series, coloured by sentiment
 *   · <BarSeries>       a discrete series with the latest bars highlighted
 *
 * Every one of them renders nothing at all rather than a misleading flat
 * line when it hasn't got at least two real datapoints — the brief is
 * explicit that no figure in the prototypes may ship, and an invented
 * series is exactly that.
 */
import type { Sentiment } from "@/lib/metrics";

/** Sentiment → stroke, theme-aware. Mirrors index.css's light overrides
 *  for .text-emerald-300 / .text-rose-300. */
const SENTIMENT_STROKE: Record<Sentiment, { dark: string; light: string }> = {
  good: { dark: "oklch(0.72 0.17 155)", light: "oklch(0.45 0.17 155)" },
  bad: { dark: "oklch(0.68 0.20 15)", light: "oklch(0.48 0.20 15)" },
  neutral: { dark: "oklch(0.80 0.17 72)", light: "oklch(0.54 0.16 55)" },
};

function isLight(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.classList.contains("light");
}

export function sentimentStroke(sentiment: Sentiment): string {
  const pair = SENTIMENT_STROKE[sentiment];
  return isLight() ? pair.light : pair.dark;
}

/** The brand accent, resolved for SVG paint. */
function accentStroke(): string {
  return isLight() ? "oklch(0.54 0.16 55)" : "oklch(0.80 0.17 72)";
}

/** Neutral bar fill for the un-highlighted part of a bar series. */
function neutralFill(): string {
  return isLight() ? "oklch(0 0 0 / 18%)" : "oklch(1 0 0 / 22%)";
}

function guide(strong = false): string {
  if (isLight()) return strong ? "oklch(0 0 0 / 14%)" : "oklch(0 0 0 / 8%)";
  return strong ? "oklch(1 0 0 / 12%)" : "oklch(1 0 0 / 7%)";
}

function tickFill(): string {
  return isLight() ? "oklch(0.45 0.015 260)" : "oklch(0.62 0.012 260)";
}

/**
 * Cash-rate step chart. A policy rate moves in discrete jumps and holds
 * flat between them, so the line is stepped (hold, then rise) rather than
 * interpolated — an interpolated line would draw a gradual climb the RBA
 * never made.
 *
 * `points` are {t, value} in whatever units the series uses; both axes are
 * normalised here. `ticks` are the mono year labels along the baseline.
 */
export function StepChart({
  points,
  ticks = [],
  height = 118,
  label,
}: {
  points: Array<{ t: number; value: number }>;
  /** Baseline labels as {t, label}, positioned on the same t scale. */
  ticks?: Array<{ t: number; label: string }>;
  height?: number;
  label: string;
}) {
  if (points.length < 2) return null;

  const W = 340;
  const TOP = 12;
  const BASE = height - 14;

  const ts = points.map((p) => p.t);
  const vs = points.map((p) => p.value);
  const tMin = Math.min(...ts);
  const tMax = Math.max(...ts);
  const tSpan = tMax - tMin || 1;
  const vMin = Math.min(...vs);
  const vMax = Math.max(...vs);
  const vSpan = vMax - vMin || 1;

  const x = (t: number) => ((t - tMin) / tSpan) * W;
  const y = (v: number) => BASE - ((v - vMin) / vSpan) * (BASE - TOP);

  // Step the path: hold the previous value across to the new x, then jump.
  const coords: string[] = [];
  points.forEach((p, i) => {
    const prev = points[i - 1];
    if (prev) coords.push(`${x(p.t).toFixed(1)},${y(prev.value).toFixed(1)}`);
    coords.push(`${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`);
  });

  const last = points[points.length - 1]!;
  const stroke = accentStroke();
  const mid = TOP + (BASE - TOP) / 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      style={{ width: "100%", height, display: "block" }}
      role="img"
      aria-label={label}
    >
      <line x1="0" y1={TOP} x2={W} y2={TOP} stroke={guide()} strokeWidth="1" />
      <line x1="0" y1={mid} x2={W} y2={mid} stroke={guide()} strokeWidth="1" />
      <line x1="0" y1={BASE} x2={W} y2={BASE} stroke={guide(true)} strokeWidth="1" />
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx={x(last.t)} cy={y(last.value)} r="3.5" fill={stroke} />
      {ticks.map((tick) => (
        <text
          key={`${tick.t}-${tick.label}`}
          x={Math.min(W - 26, Math.max(0, x(tick.t)))}
          y={height - 2}
          fontFamily="var(--font-mono)"
          fontSize="8.5"
          letterSpacing="1"
          fill={tickFill()}
        >
          {tick.label}
        </text>
      ))}
    </svg>
  );
}

/**
 * Metric sparkline. 200×40 viewBox, 2px polyline coloured by the metric's
 * sentiment (is this number moving in the direction the partner channel
 * wants?) rather than by raw direction.
 */
export function MetricSparkline({
  values,
  sentiment = "neutral",
  height = 40,
  label,
}: {
  values: number[];
  sentiment?: Sentiment;
  height?: number;
  label?: string;
}) {
  if (!values || values.length < 2) return null;

  const W = 200;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = W / (values.length - 1);

  const points = values
    .map((v, i) => {
      const x = i * stepX;
      // Inset by the stroke width so the extremes aren't clipped at the edges.
      const y = height - 3 - ((v - min) / span) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      style={{ width: "100%", height, display: "block" }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <polyline
        points={points}
        fill="none"
        stroke={sentimentStroke(sentiment)}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Bar series. Neutral bars with the most recent `highlight` bars painted
 * in the sentiment colour, so the eye lands on "where we are now" without
 * needing a legend. Used for clearance (12 weeks) and roll-offs (6 months).
 */
export function BarSeries({
  values,
  sentiment = "neutral",
  highlight = 2,
  height = 40,
  label,
}: {
  values: number[];
  sentiment?: Sentiment;
  /** How many trailing bars carry the series colour. */
  highlight?: number;
  height?: number;
  label?: string;
}) {
  if (!values || values.length < 2) return null;

  const W = 200;
  // 12px bars at a 17px pitch is the prototype's rhythm; when a series is
  // shorter or longer than 12 points, hold the 12/17 ratio and let the
  // pitch fall out of the count so the row always fills the width.
  const pitch = W / values.length;
  const barW = Math.max(2, pitch * (12 / 17));

  const min = Math.min(...values, 0);
  const max = Math.max(...values);
  const span = max - min || 1;

  const hot = sentimentStroke(sentiment);
  const cold = neutralFill();
  const firstHighlighted = Math.max(0, values.length - highlight);

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      style={{ width: "100%", height, display: "block" }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {values.map((v, i) => {
        const h = Math.max(2, ((v - min) / span) * height);
        return (
          <rect
            key={i}
            x={(i * pitch).toFixed(1)}
            y={(height - h).toFixed(1)}
            width={barW.toFixed(1)}
            height={h.toFixed(1)}
            fill={i >= firstHighlighted ? hot : cold}
          />
        );
      })}
    </svg>
  );
}
