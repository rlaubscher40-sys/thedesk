/**
 * Tiny inline SVG sparkline. No chart library — just a polyline through
 * normalised points. Renders nothing when there are fewer than 2
 * datapoints (a flat line would mislead).
 *
 * Auto-coloured by trend: amber when the series ends above where it
 * started (sentiment ignored — that's the tile's job), grey when flat,
 * cool-blue when ending lower.
 */
export function Sparkline({
  values,
  width = 96,
  height = 22,
  strokeWidth = 1.4,
}: {
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
}) {
  if (!values || values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1; // avoid divide-by-zero on a perfectly flat series

  const stepX = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  // End-vs-start trend governs the stroke colour. Amber for up, slate-cool
  // for down — matches the rest of the dashboard.
  const start = values[0]!;
  const end = values[values.length - 1]!;
  const direction = end > start * 1.001 ? "up" : end < start * 0.999 ? "down" : "flat";
  const stroke =
    direction === "up"
      ? "oklch(0.78 0.18 70)"
      : direction === "down"
        ? "oklch(0.68 0.10 250)"
        : "oklch(0.55 0.02 260)";

  // Last point gets a small dot so the eye lands on "where we are now".
  const lastX = (values.length - 1) * stepX;
  const lastY = height - ((end - min) / span) * height;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="30-day trend"
      // max-width:100% lets the line shrink to fit narrow mobile tiles
      // without needing a media-query rewrite. Aspect ratio is preserved.
      style={{ display: "block", maxWidth: "100%", height: "auto" }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={1.8} fill={stroke} />
    </svg>
  );
}
