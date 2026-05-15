/**
 * Custom logomark — abstract desk + horizon glyph, drawn fresh in SVG so we
 * can animate the strokes on first paint. Sits paired with the Playfair
 * wordmark; together they form the brand lockup.
 *
 * Geometry: a horizontal rule (the desk top), a vertical column (the
 * upright of a "D" and the leg of the desk), and a curved D-form that
 * doubles as the writing surface. A small amber dot on the right marks
 * the live indicator.
 *
 * The first-paint variant uses `draw-stroke` to ink each stroke in
 * sequence — slightly different `--len` values per stroke length.
 */
import { cn } from "@/lib/cn";

type Props = {
  /** Side length in px. */
  size?: number;
  className?: string;
  /** Animate strokes on mount. Default true. */
  animated?: boolean;
};

export function Logomark({ size = 32, className, animated = true }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logomark-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.96 0.08 88)" />
          <stop offset="55%" stopColor="oklch(0.80 0.18 76)" />
          <stop offset="100%" stopColor="oklch(0.62 0.15 60)" />
        </linearGradient>
      </defs>
      <g
        stroke="url(#logomark-gradient)"
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      >
        {/* Horizon — 36 wide. */}
        <line
          x1="14"
          y1="22"
          x2="50"
          y2="22"
          style={
            animated
              ? {
                  strokeDasharray: 40,
                  strokeDashoffset: 40,
                  animation: "draw-stroke 700ms cubic-bezier(0.16,1,0.3,1) 100ms forwards",
                  ["--len" as never]: "40",
                }
              : {}
          }
        />
        {/* Upright — 24 tall. */}
        <line
          x1="18"
          y1="22"
          x2="18"
          y2="46"
          style={
            animated
              ? {
                  strokeDasharray: 28,
                  strokeDashoffset: 28,
                  animation: "draw-stroke 600ms cubic-bezier(0.16,1,0.3,1) 220ms forwards",
                  ["--len" as never]: "28",
                }
              : {}
          }
        />
        {/* D-curve — roughly 60 along the path. */}
        <path
          d="M22 26 Q 48 26 48 36 Q 48 46 22 46"
          style={
            animated
              ? {
                  strokeDasharray: 65,
                  strokeDashoffset: 65,
                  animation: "draw-stroke 800ms cubic-bezier(0.16,1,0.3,1) 320ms forwards",
                  ["--len" as never]: "65",
                }
              : {}
          }
        />
      </g>
      {/* Live indicator dot — fades in last. */}
      <circle
        cx="50"
        cy="22"
        r="2.6"
        fill="oklch(0.85 0.19 75)"
        style={
          animated
            ? {
                opacity: 0,
                animation: "first-paint-fade 400ms cubic-bezier(0.16,1,0.3,1) 900ms forwards",
              }
            : {}
        }
      />
    </svg>
  );
}

/**
 * Full brand lockup — logomark + Playfair wordmark + by-line. The
 * "first-paint" classes are applied on the parent if you want the
 * intro choreography; otherwise renders static.
 */
export function BrandLockup({
  size = 32,
  byline = true,
  animated = false,
}: {
  size?: number;
  byline?: boolean;
  animated?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Logomark size={size} animated={animated} />
      <div className="leading-none">
        <span
          className="font-serif font-bold tracking-tight wordmark"
          style={{ fontSize: Math.round(size * 0.7) }}
        >
          The Desk
        </span>
        {byline && (
          <p
            className="overline mt-1.5"
            style={{ fontSize: 8, letterSpacing: "0.14em" }}
          >
            Intelligence · Sydney
          </p>
        )}
      </div>
    </div>
  );
}
