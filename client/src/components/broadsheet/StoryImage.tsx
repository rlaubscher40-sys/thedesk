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
import { cn } from "@/lib/cn";
import { useCategoryColour } from "@/lib/category";

export function StoryImage({
  category,
  caption,
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
  const colour = useCategoryColour()(category);
  return (
    <figure className={cn("m-0", className)}>
      <div className="rule-hair py-3" aria-hidden="true" style={{ borderColor: colour }}>
        <span className="bs-label" style={{ color: colour }}>
          {category ?? "The Desk"}
        </span>
      </div>
      {caption && (
        <figcaption className="bs-label mt-2.5" style={{ letterSpacing: "0.14em" }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
