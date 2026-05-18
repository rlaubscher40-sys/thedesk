/**
 * Logomark, D-Sunrise.
 *
 * The brand mark. A stylised uppercase "D" where the vertical stroke is
 * a thin editorial rule, the bowl is a wide arc, and a filled sun-dome
 * with radiating rays sits inside the bowl. Geometry mirrors the
 * canonical vectors at client/public/brand/desk-logo-*.svg, do not
 * stretch, compress, or rotate (brand guide §2.2).
 *
 * Two geometries:
 *   · full     , 13 rays, stroke 5.0, ray-stroke 1.8. Used at ≥32px.
 *   · simplified, 7 rays, stroke 7.0, ray-stroke 3.0. Used <32px. This
 *     is the brand-approved favicon variant: "simplified variant with
 *     fewer rays for legibility" per the §12 collateral checklist.
 *
 * Colour comes from the parent via currentColor. The .brand-mark class
 * resolves to --color-amber in dark mode and --color-fg (navy) in
 * light mode, matching the brand guide's dark / light mark variants.
 *
 * Animated first-paint: D-frame strokes ink in left-to-right, the bowl
 * arc draws, then the sun dome and rays fade in last. The animated
 * first-paint sequence is the only effect permitted on the mark.
 */
import { cn } from "@/lib/cn";

type Props = {
  size?: number;
  className?: string;
  animated?: boolean;
};

const ASPECT = 240 / 280;
const SIMPLIFY_BELOW = 32;

/** Full (13-ray) ray endpoints, anchored at (104.3, 173). */
const RAYS_FULL: Array<[number, number]> = [
  [58, 173], [58, 160.6], [58, 146.3], [63.3, 132], [75.3, 122.8],
  [89.3, 117], [104.3, 115], [119.3, 117], [133.3, 122.8], [145.3, 132],
  [154.5, 144], [160.3, 158], [162.3, 173],
];

/** Simplified (7-ray) endpoints, the favicon-variant geometry. */
const RAYS_SIMPLIFIED: Array<[number, number]> = [
  [58, 173], [61.6, 148.3], [79.7, 130.3], [104.3, 123.7],
  [128.9, 130.3], [147, 148.3], [153.6, 173],
];

export function Logomark({ size = 32, className, animated = true }: Props) {
  const simplified = size < SIMPLIFY_BELOW;
  const frameStroke = simplified ? 7 : 5;
  const rayStroke = simplified ? 3 : 1.8;
  const rays = simplified ? RAYS_SIMPLIFIED : RAYS_FULL;
  const width = Math.round(size * ASPECT);

  const drawStroke = (length: number, delay: number, duration = 700) =>
    animated
      ? {
          strokeDasharray: length,
          strokeDashoffset: length,
          animation: `draw-stroke ${duration}ms cubic-bezier(0.16,1,0.3,1) ${delay}ms forwards`,
          ["--len" as never]: String(length),
        }
      : {};

  const fadeIn = (delay: number, duration = 500) =>
    animated
      ? {
          opacity: 0,
          animation: `first-paint-fade ${duration}ms cubic-bezier(0.16,1,0.3,1) ${delay}ms forwards`,
        }
      : {};

  return (
    <svg
      width={width}
      height={size}
      viewBox="0 0 240 280"
      className={cn("brand-mark shrink-0", className)}
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* D frame, thick strokes inked sequentially on first paint. */}
        <g strokeWidth={frameStroke}>
          <line x1="56" y1="16" x2="56" y2="264" style={drawStroke(248, 100, 800)} />
          <line x1="56" y1="100" x2="92" y2="100" style={drawStroke(36, 350, 360)} />
          <line x1="56" y1="264" x2="92" y2="264" style={drawStroke(36, 420, 360)} />
          <path d="M 92 100 A 82 82 0 0 1 92 264" style={drawStroke(260, 260, 900)} />
        </g>

        {/* Sun dome, filled half-disc seated on the editorial baseline. */}
        <path
          d="M 68.3 177 A 36 36 0 0 1 140.3 177 Z"
          fill="currentColor"
          stroke="none"
          style={fadeIn(900)}
        />

        {/* Sun rays, radiating lines, the editorial register. Variant
            geometry (7-ray simplified vs 13-ray full) per size threshold. */}
        <g strokeWidth={rayStroke} style={fadeIn(1050)}>
          {rays.map(([x2, y2], i) => (
            <line key={i} x1="104.3" y1="173" x2={x2} y2={y2} />
          ))}
        </g>
      </g>
    </svg>
  );
}

/**
 * Brand lockup, mark + Playfair "The Desk" wordmark + INTELLIGENCE
 * byline. The canonical brand surface (guide §2.1). The byline is
 * non-negotiable; do not substitute or remove it from the standard
 * lockup. Pass `byline={false}` only for compressed chrome (sticky
 * masthead, narrow mobile contexts) per the minimum-size rule.
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
  const wordmarkSize = Math.round(size * 0.66);
  return (
    <div className="flex items-center gap-2.5">
      <Logomark size={size} animated={animated} />
      <div className="leading-none">
        <span
          className="font-serif font-bold tracking-tight wordmark block"
          style={{ fontSize: wordmarkSize }}
        >
          The Desk
        </span>
        {byline && (
          <p
            className="overline text-[var(--color-fg-subtle)] mt-1.5"
            style={{ fontSize: 9, letterSpacing: "0.22em" }}
          >
            INTELLIGENCE
          </p>
        )}
      </div>
    </div>
  );
}
