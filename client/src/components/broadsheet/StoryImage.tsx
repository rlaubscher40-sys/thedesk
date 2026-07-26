/**
 * Editorial image frame.
 *
 * The prototypes leave every image position as an empty <image-slot>: what
 * fills them is the one question the redesign explicitly does not answer.
 * Rather than invent an imagery system, this keeps the product's existing
 * answer and re-dresses it for the broadsheet — the deterministic
 * hero-library cover (`useHeroFallback`), over a category-tinted plate
 * when the library is empty.
 *
 * What changes is the frame, not the source: square corners, no shadow, no
 * Ken Burns drift, no specular sweep, and an optional mono caption on the
 * hairline below. Swapping in commissioned art later is a change to this
 * one component.
 */
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useCategoryColour } from "@/lib/category";
import { useHeroFallback } from "@/lib/useHeroFallback";

export function StoryImage({
  seed,
  category,
  alt,
  caption,
  aspect = "16 / 9",
  className,
}: {
  /** Feed item id — keeps a story on the same cover between renders. */
  seed: number;
  category: string | null | undefined;
  alt: string;
  caption?: string;
  /** CSS aspect-ratio for the frame. 16/9 for leads, 3/2 for story columns. */
  aspect?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const colourFor = useCategoryColour();
  const colour = colourFor(category);
  const url = useHeroFallback(seed, !failed);

  return (
    <figure className={cn("m-0", className)}>
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: aspect,
          background: `linear-gradient(135deg, ${colour}14 0%, transparent 60%), var(--color-panel-tile-bg)`,
          // The watermark below is sized in cqw so a long category name
          // ("GEOPOLITICS") scales to the frame instead of overflowing it —
          // the frame is a different width in the lead, the story columns
          // and the story page, and a viewport-relative size can't serve
          // all three.
          containerType: "inline-size",
        }}
      >
        {url && !failed ? (
          <img
            src={url}
            alt={alt}
            // Deliberately NOT .editorial-art-img: that class fades art to
            // 62% and desaturates it, which existed to stop dark-authored
            // illustrations reading as black rectangles *behind* text on
            // the old cards. Here the image is a standalone framed
            // element, so it renders at full strength.
            className="absolute inset-0 h-full w-full object-cover object-center"
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          // Library empty: the category set large as a watermark, which is
          // the product's long-standing final fallback.
          <span
            className="absolute inset-0 flex items-center justify-center font-serif font-bold select-none pointer-events-none"
            style={{
              color: colour,
              opacity: 0.16,
              fontSize: "11cqw",
              lineHeight: 1,
              letterSpacing: "-0.04em",
            }}
            aria-hidden="true"
          >
            {(category ?? "The Desk").toString().toUpperCase()}
          </span>
        )}
      </div>
      {caption && (
        <figcaption className="bs-label mt-2.5" style={{ letterSpacing: "0.14em" }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
