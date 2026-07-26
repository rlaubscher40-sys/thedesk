/** Category presentation helpers, colour mapping + accent class. */
import { useCallback } from "react";
import type { Category } from "@shared/const";
import { useTheme, type ResolvedTheme } from "@/lib/theme";

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
 * Raw oklch values mirroring the CSS variables in index.css, one map per
 * theme.
 *
 * Charts (Recharts, and the hand-rolled broadsheet SVGs) paint with real
 * `fill` / `stroke` values rather than `var(...)` references — a CSS custom
 * property in an SVG presentation attribute is not reliably substituted —
 * so these stay resolved colours and must be kept in sync with the
 * --color-* tokens by hand.
 *
 * The light map is the one the product now reads by default: the saturated
 * dark-canvas values blow out on warm paper and several of them miss WCAG AA
 * as small label text there, which is why the light theme redefines every
 * category token in index.css.
 */
const CATEGORY_COLOUR_DARK: Record<string, string> = {
  PROPERTY: "oklch(0.72 0.17 155)",
  MACRO: "oklch(0.75 0.18 70)",
  TECH: "oklch(0.65 0.18 255)",
  POLICY: "oklch(0.65 0.18 295)",
  MARKETS: "oklch(0.72 0.18 45)",
  AI: "oklch(0.7 0.18 210)",
  SCIENCE: "oklch(0.68 0.2 15)",
  // Chartreuse-gold — moved out of the amber zone to separate from MACRO
  // (matches --color-economics in index.css). See contrast/ΔE audit.
  ECONOMICS: "oklch(0.74 0.155 110)",
  GEOPOLITICS: "oklch(0.7 0.15 180)",
  OTHER: "oklch(0.62 0.012 260)",
};

const CATEGORY_COLOUR_LIGHT: Record<string, string> = {
  PROPERTY: "oklch(0.50 0.17 155)",
  MACRO: "oklch(0.54 0.18 60)",
  TECH: "oklch(0.52 0.20 255)",
  POLICY: "oklch(0.52 0.20 295)",
  MARKETS: "oklch(0.55 0.18 38)",
  AI: "oklch(0.49 0.18 210)",
  SCIENCE: "oklch(0.55 0.20 15)",
  ECONOMICS: "oklch(0.53 0.111 110)",
  GEOPOLITICS: "oklch(0.50 0.15 180)",
  OTHER: "oklch(0.42 0.015 260)",
};

const MAPS: Record<ResolvedTheme, Record<string, string>> = {
  dark: CATEGORY_COLOUR_DARK,
  light: CATEGORY_COLOUR_LIGHT,
};

/** Read the live theme off <html> — the same class ThemeProvider writes. */
function domTheme(): ResolvedTheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function categoryAccentClass(category: string | null | undefined): string {
  return ACCENT_CLASS[(category ?? "OTHER").toUpperCase()] ?? "accent-other";
}

/**
 * Resolved colour for a category in the given theme.
 *
 * `theme` is optional: callers outside React (or ones that don't re-render
 * on a theme flip anyway) can omit it and get the theme currently on
 * <html>. Components that paint category colour into styles should prefer
 * {@link useCategoryColour}, which re-renders when the reader toggles the
 * theme instead of keeping the colour from the first paint.
 */
export function categoryColour(
  category: Category | string | null | undefined,
  theme: ResolvedTheme = domTheme()
): string {
  const map = MAPS[theme];
  return map[(category ?? "OTHER").toUpperCase()] ?? "var(--color-fg-subtle)";
}

/** Theme-bound {@link categoryColour}. Re-renders on a theme toggle. */
export function useCategoryColour(): (
  category: Category | string | null | undefined
) => string {
  const { resolvedTheme } = useTheme();
  return useCallback(
    (category: Category | string | null | undefined) =>
      categoryColour(category, resolvedTheme),
    [resolvedTheme]
  );
}
