/**
 * Logomark — "Sunrise on the desk".
 *
 * A sun rising on a horizon. The horizon doubles as the editorial rule
 * carried across the rest of the brand. Conceptual fit: "The Desk" =
 * the surface where intelligence is processed; the sunrise = the daily
 * morning brief.
 *
 * Geometry:
 *   · A square frame at 64×64.
 *   · A long horizon line two-thirds of the way down.
 *   · A circle (sun) centred on the horizon — top half visible, with a
 *     stroke ring catching dawn light.
 *   · A small gold dot above the horizon to the right (the live mark).
 *   · A thicker accent rule above the horizon on the right hand side —
 *     the editorial register; this is the kicker rule that every page
 *     header carries.
 *
 * On first-paint each stroke inks in sequentially via the draw-stroke
 * keyframe. Subsequent renders are static.
 */
import { cn } from "@/lib/cn";

type Props = {
  size?: number;
  className?: string;
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
        <linearGradient id="logomark-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.94 0.10 84)" />
          <stop offset="55%" stopColor="oklch(0.78 0.18 76)" />
          <stop offset="100%" stopColor="oklch(0.55 0.14 60)" />
        </linearGradient>
        <linearGradient id="logomark-horizon" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.78 0.18 70 / 0%)" />
          <stop offset="50%" stopColor="oklch(0.85 0.18 74)" />
          <stop offset="100%" stopColor="oklch(0.78 0.18 70 / 0%)" />
        </linearGradient>
      </defs>

      {/* Subtle frame — almost invisible, just a structural anchor. */}
      <rect
        x="6"
        y="6"
        width="52"
        height="52"
        rx="4"
        fill="none"
        stroke="oklch(1 0 0 / 6%)"
      />

      {/* Sun. Top half exposed, lower half hidden behind the horizon. */}
      <circle
        cx="32"
        cy="40"
        r="11"
        fill="url(#logomark-sun)"
        style={
          animated
            ? {
                opacity: 0,
                animation:
                  "first-paint-fade 700ms cubic-bezier(0.16,1,0.3,1) 350ms forwards",
              }
            : {}
        }
      />
      {/* Sun rim catching light — fine stroke arc above. */}
      <path
        d="M 21 40 A 11 11 0 0 1 43 40"
        fill="none"
        stroke="oklch(0.96 0.08 88)"
        strokeWidth="1"
        strokeLinecap="round"
        strokeOpacity="0.55"
        style={
          animated
            ? {
                strokeDasharray: 36,
                strokeDashoffset: 36,
                animation:
                  "draw-stroke 700ms cubic-bezier(0.16,1,0.3,1) 480ms forwards",
                ["--len" as never]: "36",
              }
            : {}
        }
      />

      {/* Horizon. The long brand rule. */}
      <line
        x1="8"
        y1="40"
        x2="56"
        y2="40"
        stroke="url(#logomark-horizon)"
        strokeWidth="2"
        strokeLinecap="round"
        style={
          animated
            ? {
                strokeDasharray: 50,
                strokeDashoffset: 50,
                animation:
                  "draw-stroke 700ms cubic-bezier(0.16,1,0.3,1) 100ms forwards",
                ["--len" as never]: "50",
              }
            : {}
        }
      />

      {/* Editorial kicker — short heavy rule above the horizon, right side. */}
      <line
        x1="36"
        y1="20"
        x2="50"
        y2="20"
        stroke="oklch(0.85 0.18 74)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeOpacity="0.85"
        style={
          animated
            ? {
                strokeDasharray: 16,
                strokeDashoffset: 16,
                animation:
                  "draw-stroke 500ms cubic-bezier(0.16,1,0.3,1) 800ms forwards",
                ["--len" as never]: "16",
              }
            : {}
        }
      />
      {/* Thin secondary rule under the kicker. */}
      <line
        x1="40"
        y1="24"
        x2="50"
        y2="24"
        stroke="oklch(0.85 0.18 74)"
        strokeWidth="1"
        strokeLinecap="round"
        strokeOpacity="0.45"
        style={
          animated
            ? {
                strokeDasharray: 12,
                strokeDashoffset: 12,
                animation:
                  "draw-stroke 400ms cubic-bezier(0.16,1,0.3,1) 920ms forwards",
                ["--len" as never]: "12",
              }
            : {}
        }
      />
    </svg>
  );
}

/**
 * Full brand lockup — logomark + Playfair wordmark.
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
          style={{ fontSize: Math.round(size * 0.66) }}
        >
          The Desk
        </span>
        {byline && (
          <p
            className="overline mt-1.5"
            style={{ fontSize: 8, letterSpacing: "0.16em" }}
          >
            Intelligence · Sydney
          </p>
        )}
      </div>
    </div>
  );
}
