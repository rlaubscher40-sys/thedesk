/**
 * Rounded category pill. Coloured by category. Three variants:
 *
 *   · solid  , amber gradient fill (used for FEATURED + category on the
 *               lead story so it reads as "this is THE story today")
 *   · outline, coloured border + text matching the category. Default.
 *   · ghost  , neutral border, used on Further signals where the
 *               accent should be quieter
 */
import { categoryColour } from "@/lib/category";
import { cn } from "@/lib/cn";
import type { Category } from "@/data/editions/2026-05-15";

type Props = {
  category: Category | "FEATURED" | "RUBEN'S PICK";
  variant?: "solid" | "outline" | "ghost";
  className?: string;
};

export function CategoryPill({ category, variant = "outline", className }: Props) {
  if (variant === "solid") {
    return (
      <span
        className={cn(
          "inline-flex items-center font-mono font-semibold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full",
          className
        )}
        style={{
          fontSize: "10px",
          background:
            "linear-gradient(135deg, oklch(0.85 0.18 74 / 22%) 0%, oklch(0.75 0.18 70 / 14%) 100%)",
          color: "oklch(0.90 0.16 76)",
          boxShadow: "inset 0 0 0 1px oklch(0.85 0.18 74 / 40%)",
        }}
      >
        {category}
      </span>
    );
  }

  const colour =
    category === "FEATURED" || category === "RUBEN'S PICK"
      ? "oklch(0.78 0.18 70)"
      : categoryColour(category);

  if (variant === "outline") {
    return (
      <span
        className={cn(
          "inline-flex items-center font-mono font-semibold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full",
          className
        )}
        style={{
          fontSize: "10px",
          color: colour,
          boxShadow: `inset 0 0 0 1px ${colour}55`,
          background: `${colour}08`,
        }}
      >
        {category}
      </span>
    );
  }

  // ghost
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono font-semibold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full",
        className
      )}
      style={{
        fontSize: "10px",
        color: "var(--color-fg-muted)",
        boxShadow: "inset 0 0 0 1px var(--color-border-strong)",
      }}
    >
      {category}
    </span>
  );
}

/**
 * "RUBEN'S PICK · MACRO" double pill, the editorial mast on the lead
 * story. The first half names the curator (the value prop of a daily
 * brief: someone picked this for you); the second half names the
 * category.
 */
export function FeaturedPill({ category }: { category: Category }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <CategoryPill category="RUBEN'S PICK" variant="ghost" />
      <CategoryPill category={category} variant="solid" />
    </span>
  );
}
