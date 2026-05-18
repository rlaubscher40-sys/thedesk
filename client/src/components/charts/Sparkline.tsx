/**
 * Tiny inline sparkline. SVG, no library, just enough to sit next to a
 * KPI value and tell the eye where it's been.
 *
 * Renders a smooth path through the points plus an area fill below.
 * Highlights the last point with a small filled dot.
 */
import { useId } from "react";

type Props = {
  values: number[];
  /** Pixel width, defaults to compact KPI tile size. */
  width?: number;
  height?: number;
  /** Stroke colour (CSS string). */
  colour?: string;
  /** Show the trailing endpoint dot. */
  showEnd?: boolean;
};

function smoothPath(points: Array<[number, number]>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0]![0]},${points[0]![1]}`;
  const [first, ...rest] = points;
  let d = `M${first![0]},${first![1]}`;
  for (let i = 0; i < rest.length; i++) {
    const cur = rest[i]!;
    const prev = i === 0 ? first! : rest[i - 1]!;
    const mx = (prev[0] + cur[0]) / 2;
    d += ` Q${prev[0]},${prev[1]} ${mx},${(prev[1] + cur[1]) / 2}`;
    d += ` T${cur[0]},${cur[1]}`;
  }
  return d;
}

export function Sparkline({
  values,
  width = 140,
  height = 36,
  colour = "oklch(0.78 0.18 70)",
  showEnd = true,
}: Props) {
  const id = useId();
  if (values.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="oklch(1 0 0 / 12%)"
          strokeWidth={1}
        />
      </svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 3;
  const innerH = height - pad * 2;
  const stepX = (width - pad * 2) / (values.length - 1);
  const pts: Array<[number, number]> = values.map((v, i) => [
    pad + i * stepX,
    pad + innerH - ((v - min) / range) * innerH,
  ]);
  const linePath = smoothPath(pts);
  const last = pts[pts.length - 1]!;
  const areaPath = `${linePath} L${last[0]},${height - pad} L${pts[0]![0]},${height - pad} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colour} stopOpacity={0.28} />
          <stop offset="100%" stopColor={colour} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${id}-fill)`} />
      <path d={linePath} fill="none" stroke={colour} strokeWidth={1.4} strokeLinecap="round" />
      {showEnd && (
        <>
          <circle cx={last[0]} cy={last[1]} r={3.5} fill={colour} />
          <circle cx={last[0]} cy={last[1]} r={6} fill={colour} fillOpacity={0.22} />
        </>
      )}
    </svg>
  );
}
