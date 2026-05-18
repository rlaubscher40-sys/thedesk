/** Category presentation helpers, colour mapping + accent class. */
import type { Category } from "@shared/const";

const ACCENT_CLASS: Record<string, string> = {
  PROPERTY: "accent-property",
  MACRO: "accent-macro",
  TECH: "accent-tech",
  POLICY: "accent-policy",
  MARKETS: "accent-markets",
  AI: "accent-ai",
  SCIENCE: "accent-science",
  ECONOMICS: "accent-economics",
  GEOPOLITICS: "accent-geopolitics",
  OTHER: "accent-other",
};

/**
 * Raw oklch values mirroring the CSS variables in index.css. Charts (Recharts)
 * paint with real SVG `fill`/`stroke` values, not CSS vars, so these are kept
 * as resolved colours rather than `var(...)` references.
 */
const CATEGORY_COLOUR: Record<string, string> = {
  PROPERTY: "oklch(0.72 0.17 155)",
  MACRO: "oklch(0.75 0.18 70)",
  TECH: "oklch(0.65 0.18 255)",
  POLICY: "oklch(0.65 0.18 295)",
  MARKETS: "oklch(0.72 0.18 45)",
  AI: "oklch(0.7 0.18 210)",
  SCIENCE: "oklch(0.68 0.2 15)",
  ECONOMICS: "oklch(0.75 0.16 78)",
  GEOPOLITICS: "oklch(0.7 0.15 180)",
  OTHER: "oklch(0.62 0.012 260)",
};

export function categoryAccentClass(category: string | null | undefined): string {
  return ACCENT_CLASS[(category ?? "OTHER").toUpperCase()] ?? "accent-other";
}

export function categoryColour(category: Category | string | null | undefined): string {
  return CATEGORY_COLOUR[(category ?? "OTHER").toUpperCase()] ?? "var(--color-fg-subtle)";
}
