/**
 * The metric's own history, drawn.
 *
 * The Reel that prompted this — Glasshouse's "THE FILE" — spends its middle
 * third on a wireframe globe with a route drawing itself across it, point by
 * labelled point. It is the thing that makes the clip look produced rather than
 * exported, and it is not decoration: it is the data, animated.
 *
 * Their globe traces a person's journey. Ours has to be the series, because
 * that is the asset this publication has and a news aggregator does not: every
 * number posted here sits on top of months of readings nobody else has
 * assembled. A figure alone is a claim. The same figure at the end of its own
 * history is an argument.
 *
 * ## Why an SVG data URI rather than nodes in the card tree
 *
 * Satori's SVG support is partial and version-dependent, and a chart that
 * silently renders as nothing would be worse than no chart — a hole in the
 * middle of a published post. An `<img>` with a data URI goes through resvg,
 * which is a full SVG renderer, and the failure mode of a malformed path is a
 * missing image rather than a broken layout.
 *
 * It also makes the whole thing a pure function of numbers to a string, which
 * is the only reason its edge cases (one point, a flat series, a series with a
 * single outlier) can be tested at all.
 */

export type SparkPoint = { value: number; at: Date };

/** The drawn line stops short of the frame edges so the head dot, which sits
 *  on the line, is never clipped in half by the viewbox. */
const PAD = 8;

/**
 * Reduce a long series to at most `max` points, keeping the first and last.
 *
 * Six months of daily readings is far more detail than a 1000px-wide line can
 * show, and every extra point is path data in a data URI that has to be
 * base64'd into the card. Thinning by even stride keeps the shape and the
 * extremes that matter survive because they are what the line is drawn to.
 */
export function thin<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]!);
  return out;
}

/**
 * The points, in drawing order, mapped into the box.
 *
 * A flat series is the case that breaks the obvious implementation: the value
 * range is zero, so every point divides by nothing and lands at NaN. It draws
 * down the middle instead, which is what a flat series looks like.
 */
export function project(
  values: number[],
  width: number,
  height: number
): Array<{ x: number; y: number }> {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const innerW = width - PAD * 2;
  const innerH = height - PAD * 2;
  return values.map((v, i) => ({
    x: PAD + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW),
    // SVG y grows downward, so a high value is a low y.
    y: PAD + (span === 0 ? innerH / 2 : (1 - (v - min) / span) * innerH),
  }));
}

/**
 * The visible part of the line at a given progress, with the head interpolated
 * rather than snapped to the nearest point.
 *
 * Snapping is the difference between a line that draws and a line that jumps in
 * chunks — at twenty points over three seconds, a snapped head moves seven
 * times a second in visible steps.
 */
export function traceTo(
  points: Array<{ x: number; y: number }>,
  progress: number
): Array<{ x: number; y: number }> {
  if (points.length === 0) return [];
  const p = Math.max(0, Math.min(1, progress));
  if (p === 0) return [points[0]!];
  if (p === 1) return points;
  const exact = p * (points.length - 1);
  const whole = Math.floor(exact);
  const frac = exact - whole;
  const drawn = points.slice(0, whole + 1);
  const from = points[whole]!;
  const to = points[whole + 1];
  if (to && frac > 0) {
    drawn.push({ x: from.x + (to.x - from.x) * frac, y: from.y + (to.y - from.y) * frac });
  }
  return drawn;
}

export type SparklineOptions = {
  width: number;
  height: number;
  /** 0..1. How much of the line has been drawn. */
  progress?: number;
  /** The line itself, and the dot at its head. */
  stroke: string;
  accent: string;
};

/**
 * The chart, as an SVG document.
 *
 * Deliberately spare: one line, one dot at the live end, one hairline baseline.
 * No axes, no gridlines, no numbers. The figure is already set at 300px above
 * it — the chart's whole job is to say "and here is where that sits", which is
 * a shape, not a table.
 */
export function buildSparkline(values: number[], opts: SparklineOptions): string {
  const { width, height, stroke, accent } = opts;
  const progress = opts.progress ?? 1;
  const points = project(values, width, height);
  const drawn = traceTo(points, progress);
  const path = drawn.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const head = drawn[drawn.length - 1];

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    // The baseline runs the full width from the start, so the chart occupies
    // its space before the line arrives rather than growing into it.
    `<line x1="0" y1="${height - 0.5}" x2="${width}" y2="${height - 0.5}" stroke="${stroke}" stroke-opacity="0.18" stroke-width="1"/>`,
    drawn.length > 1
      ? `<polyline points="${path}" fill="none" stroke="${stroke}" stroke-opacity="0.85" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`
      : "",
    head
      ? `<circle cx="${head.x.toFixed(1)}" cy="${head.y.toFixed(1)}" r="9" fill="${accent}"/>`
      : "",
    `</svg>`,
  ].join("");
}

/** The SVG as something an `<img src>` will accept. */
export function sparklineDataUri(values: number[], opts: SparklineOptions): string {
  const svg = buildSparkline(values, opts);
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

/**
 * "APR 2019 — AUG 2026": how far back the line goes.
 *
 * This is the caption that turns a decorative squiggle into a claim about the
 * archive, and it is the one thing on the card a competitor aggregating today's
 * headlines cannot print. It is therefore also the one that must not be
 * overstated: it says exactly the range of the readings actually drawn.
 */
export function seriesRange(points: SparkPoint[]): string | null {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return null;
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-AU", {
      month: "short",
      year: "numeric",
      timeZone: "Australia/Sydney",
    })
      .format(d)
      .toUpperCase();
  const from = fmt(first.at);
  const to = fmt(last.at);
  return from === to ? from : `${from} — ${to}`;
}
