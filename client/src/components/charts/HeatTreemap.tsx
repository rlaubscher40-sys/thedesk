/**
 * Category heat treemap — a Squarify-light layout. Each category gets a
 * tile sized proportional to its share of total signal volume, coloured
 * by category, with the category label and count overlaid.
 *
 * Pure SVG — no D3. The layout walks the list in descending order and
 * stacks tiles into rows, switching orientation when a row's worst-case
 * aspect ratio gets worse than the alternative.
 *
 * Tiles fade in with a stagger via CSS variable + animation-delay.
 */
import { categoryColour } from "@/lib/category";

type Datum = {
  category: string;
  total: number;
  daily: number;
  weekly: number;
};

type Tile = {
  category: string;
  total: number;
  daily: number;
  weekly: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

function squarify(data: Datum[], width: number, height: number): Tile[] {
  const total = data.reduce((s, d) => s + d.total, 0) || 1;
  // Sort descending so the biggest tiles land top-left.
  const sorted = [...data].sort((a, b) => b.total - a.total);
  // Each unit area scaled to the available area.
  const scale = (width * height) / total;
  const tiles: Tile[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let remainingW = width;
  let remainingH = height;

  function worstRatio(row: Datum[], length: number): number {
    if (row.length === 0) return Infinity;
    const sum = row.reduce((s, d) => s + d.total * scale, 0);
    let worst = 0;
    for (const d of row) {
      const a = d.total * scale;
      const ratio = Math.max((length * length * a) / (sum * sum), (sum * sum) / (length * length * a));
      if (ratio > worst) worst = ratio;
    }
    return worst;
  }

  function layoutRow(row: Datum[], length: number, horizontal: boolean) {
    const sum = row.reduce((s, d) => s + d.total * scale, 0);
    const thickness = sum / length;
    let offset = 0;
    for (const d of row) {
      const a = d.total * scale;
      const size = a / thickness;
      if (horizontal) {
        tiles.push({
          ...d,
          x: cursorX + offset,
          y: cursorY,
          w: size,
          h: thickness,
        });
      } else {
        tiles.push({
          ...d,
          x: cursorX,
          y: cursorY + offset,
          w: thickness,
          h: size,
        });
      }
      offset += size;
    }
    if (horizontal) {
      cursorY += thickness;
      remainingH -= thickness;
    } else {
      cursorX += thickness;
      remainingW -= thickness;
    }
  }

  let queue = [...sorted];
  let row: Datum[] = [];
  while (queue.length > 0) {
    const horizontal = remainingW >= remainingH;
    const length = horizontal ? remainingW : remainingH;
    const next = queue[0]!;
    const nextRow = [...row, next];
    if (worstRatio(nextRow, length) <= worstRatio(row, length)) {
      row = nextRow;
      queue.shift();
    } else {
      layoutRow(row, length, horizontal);
      row = [];
    }
  }
  if (row.length > 0) {
    const horizontal = remainingW >= remainingH;
    const length = horizontal ? remainingW : remainingH;
    layoutRow(row, length, horizontal);
  }
  return tiles;
}

export function HeatTreemap({
  data,
  width = 380,
  height = 280,
}: {
  data: Datum[];
  width?: number;
  height?: number;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-[var(--color-fg-muted)]">No data yet.</p>;
  }
  const tiles = squarify(data, width, height);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Category heat treemap"
    >
      {tiles.map((t, i) => {
        const colour = categoryColour(t.category);
        const showLabel = t.w > 70 && t.h > 38;
        const showCount = t.w > 50 && t.h > 22;
        // Rough char-width budget at 10px mono + 2 letter-spacing ≈ 9px
        // per char. Truncate the category label so it never overflows
        // the tile (GEOPOLITICS, DEMOGRAPHICS et al were spilling out
        // of small cells).
        const labelBudget = Math.max(3, Math.floor((t.w - 20) / 9));
        const labelText =
          t.category.length > labelBudget
            ? `${t.category.slice(0, Math.max(2, labelBudget - 1))}…`
            : t.category;
        return (
          <g
            key={t.category}
            style={{
              opacity: 0,
              animation: `first-paint-fade 480ms cubic-bezier(0.16,1,0.3,1) ${80 + i * 60}ms forwards`,
            }}
          >
            <rect
              x={t.x + 1}
              y={t.y + 1}
              width={Math.max(0, t.w - 2)}
              height={Math.max(0, t.h - 2)}
              fill={colour}
              fillOpacity={0.18}
              stroke={colour}
              strokeOpacity={0.5}
            />
            {/* Glow accent in the top-left of each tile. */}
            <rect
              x={t.x + 1}
              y={t.y + 1}
              width={Math.min(t.w - 2, 4)}
              height={Math.max(0, t.h - 2)}
              fill={colour}
              fillOpacity={0.65}
            />
            {showLabel && (
              <text
                x={t.x + 10}
                y={t.y + 22}
                fill={colour}
                fontFamily="JetBrains Mono, monospace"
                fontSize={10}
                letterSpacing="2"
                opacity="0.9"
              >
                {labelText}
              </text>
            )}
            {showCount && (
              <text
                x={t.x + 10}
                y={t.y + (showLabel ? 44 : 22)}
                fill="oklch(0.94 0.005 80)"
                fontFamily="Playfair Display, serif"
                fontWeight={700}
                fontSize={Math.min(28, Math.max(14, t.h * 0.32))}
              >
                {t.total}
              </text>
            )}
            {t.w > 90 && t.h > 60 && (
              <text
                x={t.x + 10}
                y={t.y + t.h - 10}
                fill="oklch(0.62 0.012 260)"
                fontFamily="JetBrains Mono, monospace"
                fontSize={9}
                letterSpacing="1.5"
              >
                {t.daily}d · {t.weekly}w
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
