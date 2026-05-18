/**
 * Custom multi-series line chart. Pure SVG, no chart library. Designed
 * to look hand-tuned rather than off-the-shelf: thin lines, soft area
 * fills, mono-typed axes, a faint metro-grid background, hover marker
 * with an inline value readout that follows the cursor.
 */
import { useId, useMemo, useRef, useState } from "react";

export type LineSeries = {
  key: string;
  label?: string;
  values: number[];
  colour: string;
};

type Props = {
  /** X-axis labels (e.g. edition numbers as "#14"). Length matches series.values. */
  xLabels: string[];
  series: LineSeries[];
  height?: number;
  /** Vertical inset on top + bottom for breathing room. */
  padY?: number;
  /** Horizontal inset (extra room for the y-axis tick labels). */
  padX?: number;
};

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

function buildPath(points: Array<[number, number]>): string {
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

export function LineChart({
  xLabels,
  series,
  height = 300,
  padY = 18,
  padX = 44,
}: Props) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [width, setWidth] = useState(720);

  // Measure container width, keeps the chart responsive without a
  // ResizeObserver subscription.
  useMemo(() => {
    if (typeof window === "undefined") return;
    const measure = () => {
      const w = wrapRef.current?.clientWidth ?? 720;
      setWidth(Math.max(300, w));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const innerW = Math.max(50, width - padX * 2);
  const innerH = height - padY * 2;

  const all = series.flatMap((s) => s.values).filter(Number.isFinite);
  const min = all.length ? Math.min(...all) : 0;
  const max = all.length ? Math.max(...all) : 1;
  const range = max - min || 1;
  // Pad the range so the curve doesn't kiss the top/bottom.
  const yMin = min - range * 0.06;
  const yMax = max + range * 0.06;
  const yRange = yMax - yMin || 1;

  const stepX = xLabels.length > 1 ? innerW / (xLabels.length - 1) : innerW;

  const yToPx = (v: number) => padY + innerH - ((v - yMin) / yRange) * innerH;
  const xToPx = (i: number) => padX + i * stepX;

  // Tick values along the y-axis, five evenly spaced.
  const yTicks = useMemo(() => {
    const n = 5;
    return Array.from({ length: n }, (_, i) => yMin + (i / (n - 1)) * yRange);
  }, [yMin, yRange]);

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width - padX;
    const idx = Math.round(px / stepX);
    if (idx >= 0 && idx < xLabels.length) setHoverIdx(idx);
    else setHoverIdx(null);
  }

  return (
    <div ref={wrapRef} className="relative">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHoverIdx(null)}
        role="img"
        aria-label="Line chart"
      >
        <defs>
          {series.map((s, i) => (
            <linearGradient
              key={s.key}
              id={`${id}-fill-${i}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={s.colour} stopOpacity={0.16} />
              <stop offset="100%" stopColor={s.colour} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {/* Background grid, soft horizontals only. */}
        <g>
          {yTicks.map((t, i) => (
            <line
              key={i}
              x1={padX}
              x2={width - padX}
              y1={yToPx(t)}
              y2={yToPx(t)}
              stroke="oklch(1 0 0 / 5%)"
              strokeWidth={1}
            />
          ))}
        </g>

        {/* Y-axis tick labels, mono, dim. */}
        <g
          fontFamily="JetBrains Mono, monospace"
          fontSize="10"
          fill="oklch(0.56 0.012 260)"
        >
          {yTicks.map((t, i) => (
            <text key={i} x={padX - 8} y={yToPx(t) + 3} textAnchor="end">
              {Math.abs(t) >= 100 ? t.toFixed(0) : t.toFixed(2)}
            </text>
          ))}
        </g>

        {/* Area fills + lines. */}
        {series.map((s, sIdx) => {
          const pts: Array<[number, number]> = s.values.map((v, i) => [
            xToPx(i),
            yToPx(v),
          ]);
          const path = buildPath(pts);
          const area = `${path} L${xToPx(s.values.length - 1)},${
            padY + innerH
          } L${xToPx(0)},${padY + innerH} Z`;

          return (
            <g key={s.key}>
              <path d={area} fill={`url(#${id}-fill-${sIdx})`} />
              <path
                d={path}
                fill="none"
                stroke={s.colour}
                strokeWidth={1.6}
                strokeLinecap="round"
                style={{
                  // Light draw-in on mount.
                  strokeDasharray: 1400,
                  strokeDashoffset: 1400,
                  animation: `draw-stroke 1100ms ${EASE} ${100 + sIdx * 80}ms forwards`,
                  ["--len" as never]: "1400",
                }}
              />
            </g>
          );
        })}

        {/* Hover crosshair + value readout. */}
        {hoverIdx != null && (
          <g>
            <line
              x1={xToPx(hoverIdx)}
              x2={xToPx(hoverIdx)}
              y1={padY}
              y2={padY + innerH}
              stroke="oklch(0.78 0.18 70 / 35%)"
              strokeWidth={1}
            />
            {series.map((s) => {
              const v = s.values[hoverIdx];
              if (v == null || !Number.isFinite(v)) return null;
              return (
                <circle
                  key={s.key}
                  cx={xToPx(hoverIdx)}
                  cy={yToPx(v)}
                  r={4}
                  fill={s.colour}
                  stroke="oklch(0.11 0.018 260)"
                  strokeWidth={2}
                />
              );
            })}
          </g>
        )}

        {/* X-axis labels, mono, dim. */}
        <g
          fontFamily="JetBrains Mono, monospace"
          fontSize="10"
          fill="oklch(0.56 0.012 260)"
        >
          {xLabels.map((label, i) => (
            <text key={i} x={xToPx(i)} y={height - 4} textAnchor="middle">
              {label}
            </text>
          ))}
        </g>
      </svg>

      {/* HTML tooltip floating above the SVG for crisp text rendering. */}
      {hoverIdx != null && (
        <div
          className="absolute pointer-events-none panel rounded-sm px-3 py-2 text-xs font-mono shadow-xl"
          style={{
            left: `min(calc(100% - 180px), max(0px, ${(xToPx(hoverIdx) / width) * 100}% - 80px))`,
            top: 8,
            minWidth: 160,
          }}
        >
          <p
            className="overline mb-1.5 text-[var(--color-fg-subtle)]"
            style={{ fontSize: "10px", letterSpacing: "0.18em" }}
          >
            {xLabels[hoverIdx]}
          </p>
          {series.map((s) => {
            const v = s.values[hoverIdx];
            return (
              <div key={s.key} className="flex items-center justify-between gap-3 py-0.5">
                <span className="flex items-center gap-1.5 text-[var(--color-fg-muted)]">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: s.colour }}
                  />
                  {s.label ?? s.key}
                </span>
                <span className="tabular-nums text-[var(--color-fg)]">
                  {v != null && Number.isFinite(v) ? v.toFixed(2) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
