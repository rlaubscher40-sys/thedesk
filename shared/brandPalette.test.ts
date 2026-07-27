import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BRAND_LIGHT,
  BRAND_LIGHT_BORDER,
  flattenBlackAlpha,
  LIGHT_OKLCH,
  oklchToHex,
  withAlpha,
} from "./brandPalette";

const CSS_PATH = path.join(process.cwd(), "client/src/index.css");

/**
 * Pull the `.light { … }` block out of index.css. Deliberately a dumb brace
 * scan rather than a CSS parser: the point is to read the same text a human
 * would when they retune a token.
 */
function lightBlock(): string {
  const css = fs.readFileSync(CSS_PATH, "utf8");
  const start = css.indexOf(".light {");
  if (start === -1) throw new Error("could not find the .light block in index.css");
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(start, i);
    }
  }
  throw new Error(".light block in index.css is unbalanced");
}

function declaredOklch(block: string, token: string): [number, number, number] | null {
  // e.g. "--color-fg-muted: oklch(0.40 0.015 260);"
  const re = new RegExp(`${token}\\s*:\\s*oklch\\(([^)]+)\\)`, "u");
  const m = block.match(re);
  if (!m || !m[1]) return null;
  const parts = m[1].trim().split(/\s+/u).map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return [parts[0]!, parts[1]!, parts[2]!];
}

describe("brandPalette", () => {
  /**
   * The reason this file exists. Email, OG cards and the unsubscribe page
   * can't read CSS custom properties, so they consume BRAND_LIGHT instead.
   * If someone retunes a light token in index.css and doesn't update
   * LIGHT_OKLCH, those three surfaces drift away from the site — invisibly,
   * because nothing renders them in CI. This turns that into a red test.
   */
  it("matches the .light block in index.css, token for token", () => {
    const block = lightBlock();
    for (const [token, expected] of Object.entries(LIGHT_OKLCH)) {
      const declared = declaredOklch(block, token);
      expect(declared, `${token} not found as an oklch() value in the .light block`).not.toBeNull();
      expect(declared, `${token} drifted from index.css`).toEqual([...expected]);
    }
  });

  it("converts oklch to the sRGB hex those surfaces render", () => {
    // Spot values, so a broken conversion can't pass by agreeing with itself.
    expect(oklchToHex(0, 0, 0)).toBe("#000000");
    expect(oklchToHex(1, 0, 0)).toBe("#FFFFFF");
    expect(BRAND_LIGHT.paper).toBe("#F5F3EF");
    expect(BRAND_LIGHT.ink).toBe("#090D15");
    expect(BRAND_LIGHT.accent).toBe("#B14D00");
  });

  it("clamps out-of-gamut values into sRGB rather than emitting junk", () => {
    const hex = oklchToHex(0.6, 0.4, 150); // far outside the sRGB gamut
    expect(hex).toMatch(/^#[0-9A-F]{6}$/u);
  });

  it("pre-composites hairlines over paper", () => {
    expect(BRAND_LIGHT_BORDER).toBe(flattenBlackAlpha(BRAND_LIGHT.paper, 0.12));
    expect(flattenBlackAlpha("#FFFFFF", 0)).toBe("#FFFFFF");
    expect(flattenBlackAlpha("#FFFFFF", 1)).toBe("#000000");
  });

  it("emits rgba() for tinted plates", () => {
    expect(withAlpha("#B14D00", 0.07)).toBe("rgba(177,77,0,0.07)");
  });
});
