/**
 * Card surface primitive.
 *
 * Centralises the editorial "panel" container vocabulary — surface, radius,
 * padding, hover behaviour, accent edge, and the front-page elevation — so
 * the feed/edition cards stop hand-rolling the same class strings. The
 * variants encode the EXISTING look, so adopting Card is a refactor rather
 * than a redesign.
 *
 * Hover behaviours are independent booleans on purpose: the lead, grid, and
 * signal cards each opt into a deliberately different subset (e.g. the
 * demoted signal strip lifts but doesn't take the panel-hover wash).
 */
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

const RADIUS = { sm: "rounded-sm", md: "rounded" } as const;
const PADDING = {
  none: "",
  sm: "p-4 sm:p-5",
  md: "p-5",
  lg: "p-6 sm:p-7",
} as const;

type CardProps = ComponentPropsWithoutRef<"article"> & {
  radius?: keyof typeof RADIUS;
  padding?: keyof typeof PADDING;
  /** Clip overflow — needed by cards with a full-bleed image plate. */
  clip?: boolean;
  /** Background/border wash on hover. */
  panelHover?: boolean;
  /** TranslateY + shadow lift on hover. */
  lift?: boolean;
  /** Fade in the action row only on hover/focus-within. */
  revealOnHover?: boolean;
  /** Front-page treatment: resting drop shadow + thicker accent edge. */
  lead?: boolean;
  /** Category accent edge, e.g. categoryAccentClass(item.category). */
  accentClass?: string;
};

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  {
    radius = "md",
    padding = "none",
    clip = false,
    panelHover = false,
    lift = false,
    revealOnHover = false,
    lead = false,
    accentClass,
    className,
    children,
    ...rest
  },
  ref
) {
  return (
    <article
      ref={ref}
      className={cn(
        "panel",
        RADIUS[radius],
        PADDING[padding],
        clip && "overflow-hidden",
        panelHover && "panel-hover",
        lift && "hover-lift",
        revealOnHover && "reveal-on-hover",
        lead && "border-l-[3px] shadow-[0_14px_44px_-20px_oklch(0_0_0/65%)]",
        accentClass,
        className
      )}
      {...rest}
    >
      {children}
    </article>
  );
});
