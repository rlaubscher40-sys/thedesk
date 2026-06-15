/**
 * The one-line "Why it matters" context note. Sits between the lede and the
 * partner angles: a plain analytical sentence that gives the reader the
 * stakes of a story in a single scan, without a copy button (it's context,
 * not a script to paste). Visually quieter than SayThisLine — a tinted
 * left rule and muted serif text.
 */
import { categoryColour } from "@/lib/category";
import { dedash } from "@/lib/dedash";

export function WhyItMattersLine({
  whyItMatters,
  category,
  compact = false,
}: {
  whyItMatters: string;
  category: string;
  /** Tighter spacing + smaller text for the signal strip. */
  compact?: boolean;
}) {
  return (
    <div
      className={compact ? "mt-2 flex items-start gap-2" : "mt-4 flex items-start gap-2.5"}
    >
      <span
        className="overline-amber shrink-0 mt-1"
        style={{ color: categoryColour(category), letterSpacing: "0.2em" }}
      >
        Why it matters
      </span>
      <p
        className={
          compact
            ? "font-serif text-[13px] leading-snug text-[var(--color-fg-muted)] flex-1 min-w-0"
            : "font-serif text-[15px] leading-relaxed text-[var(--color-fg-muted)] flex-1 min-w-0"
        }
      >
        {dedash(whyItMatters)}
      </p>
    </div>
  );
}
