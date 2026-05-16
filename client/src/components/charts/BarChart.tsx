/**
 * Custom paired bar chart. Pure SVG. Renders two series of bars side by
 * side per x category. Hand-tuned chrome: thin top caps on each bar
 * (gives the bars a printed-newspaper feel), faint grid horizontals,
 * mono axis labels.
 */
import { useId, useMemo, useRef, useState } from "react";

export type BarSeries = {
  key: string;
  label?: string;
  values: number[];
  colour: string;
};

type Props = {
  xLabels: string[];
  series: BarSeries[];
  height?: number;
  padY?: number;
  padX?: number;
};

export function BarChart({
  xLabels,
  series,
  height = 280,
  padY = 16,
  padX = 44,
}: Props) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [width, setWidth] = useState(720);

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
  const innerH = height - padY * 2 - 12; // extra room for x labels
  const groups = xLabels.length;
  const groupSlot = innerW / Math.max(1, groups);
  const barWidth = Math.max(4, Math.min(22, (groupSlot - 12) / series.length));
  const all = series.flatMap((s) => s.values).filter(Number.isFinite);
  const max = all.length ? Math.max(...all, 1) : 1;

  const yTicks = useMemo(() => {
    const n = 4;
    return Array.from({ length: n }, (_, i) => (i / (n - 1)) * max);
  }, [max]);

  const yToPx = (v: number) => padY + innerH - (v / max) * innerH;
  const groupCx = (i: number) => padX + groupSlot * (i + 0.5);

  return (
    <div ref={wrapRef} className="relative">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Bar chart"
        onPointerMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * width - padX;
          const idx = Math.floor(px / groupSlot);
          if (idx >= 0 && idx < groups) setHoverIdx(idx);
          else setHoverIdx(null);
        }}
        onPointerLeave={() => setHoverIdx(null)}
      >
        {/* Faint horizontal grid. */}
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

        {/* Y-axis labels. */}
        <g
          fontFamily="JetBrains Mono, monospace"
          fontSize="10"
          fill="oklch(0.56 0.012 260)"
        >
          {yTicks.map((t, i) => (
            <text key={i} x={padX - 8} y={yToPx(t) + 3} textAnchor="end">
              {Math.round(t)}
            </text>
          ))}
        </g>

        {/* Hover shading on the active group. */}
        {hoverIdx != null && (
          <rect
            x={padX + groupSlot * hoverIdx}
            y={padY}
            width={groupSlot}
            height={innerH}
            fill="oklch(0.78 0.18 70 / 5%)"
          />
        )}

        {/* Bars + top caps. */}
        {xLabels.map((_, i) => {
          const seriesCount = series.length;
          const groupCenter = groupCx(i);
          const totalWidth = barWidth * seriesCount + 4 * (seriesCount - 1);
          const startX = groupCenter - totalWidth / 2;
          return series.map((s, sIdx) => {
            const v = s.values[i] ?? 0;
            const h = Math.max(0, (v / max) * innerH);
            const x = startX + sIdx * (barWidth + 4);
            const y = padY + innerH - h;
            return (
              <g
                key={`${s.key}-${i}`}
                style={{
                  opacity: 0,
                  animation: `first-paint-fade 600ms cubic-bezier(0.16,1,0.3,1) ${
                    100 + i * 40 + sIdx * 30
                  }ms forwards`,
                }}
              >
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={h}
                  fill={s.colour}
                  fillOpacity="0.6"
                />
                {/* Top cap — heavier 2px slab on top for newspaper feel. */}
                <rect x={x} y={y} width={barWidth} height={2} fill={s.colour} />
              </g>
            );
          });
        })}

        {/* X-axis labels. */}
        <g
          fontFamily="JetBrains Mono, monospace"
          fontSize="10"
          fill="oklch(0.56 0.012 260)"
        >
          {xLabels.map((label, i) => (
            <text key={i} x={groupCx(i)} y={height - 4} textAnchor="middle">
              {label}
            </text>
          ))}
        </g>
      </svg>

      {hoverIdx != null && (
        <div
          className="absolute pointer-events-none panel rounded-sm px-3 py-2 text-xs font-mono shadow-xl"
          style={{
            left: `min(calc(100% - 160px), max(0px, ${(groupCx(hoverIdx) / width) * 100}% - 70px))`,
            top: 8,
            minWidth: 140,
          }}
        >
          <p
            className="overline mb-1.5 text-[var(--color-fg-subtle)]"
            style={{ fontSize: "9px", letterSpacing: "0.18em" }}
          >
            {xLabels[hoverIdx]}
          </p>
          {series.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-3 py-0.5">
              <span className="flex items-center gap-1.5 text-[var(--color-fg-muted)]">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: s.colour }}
                />
                {s.label ?? s.key}
              </span>
              <span className="tabular-nums text-[var(--color-fg)]">
                {s.values[hoverIdx] ?? 0}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
