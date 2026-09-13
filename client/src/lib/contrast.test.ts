import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { categoryColour } from "./category";
const css = readFileSync("client/src/index.css", "utf8");
function token(name: string, light: boolean) {
  const values = [...css.matchAll(new RegExp(`--${name}: (oklch\\([^;]+\\));`, "g"))];
  return values[light ? 1 : 0]![1]!;
}
// sRGB conversion of the actual palette tokens, including alpha compositing.
function rgb(value: string) {
  const [l, c, h, alpha = 1] = value.match(/[\d.]+/g)!.map(Number);
  const angle = (h! * Math.PI) / 180,
    a = c! * Math.cos(angle),
    b = c! * Math.sin(angle);
  const L = (l! + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    M = (l! - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    S = (l! - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const gamma = (v: number) => {
    v = Math.max(0, Math.min(1, v));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  };
  return {
    values: [
      4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
      -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
      -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
    ].map(gamma),
    alpha: value.includes("%") ? alpha / 100 : alpha,
  };
}
function contrast(fg: string, bg: string) {
  const f = rgb(fg),
    b = rgb(bg);
  const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luminance = (v: number[]) =>
    v.map(linear).reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i]!, 0);
  const a = luminance(f.values.map((v, i) => v * f.alpha + b.values[i]! * (1 - f.alpha))),
    z = luminance(b.values);
  return (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05);
}
for (const light of [false, true])
  it(`keeps core text and category labels legible on ${light ? "light" : "dark"} page and panel backgrounds`, () => {
    for (const bg of ["color-bg", "color-bg-elevated"]) {
      for (const fg of ["color-fg", "color-fg-muted", "color-fg-subtle", "color-accent-text"])
        expect(
          contrast(token(fg, light), token(bg, light)),
          `${fg} on ${bg}`
        ).toBeGreaterThanOrEqual(4.5);
      for (const category of [
        "PROPERTY",
        "MACRO",
        "TECH",
        "POLICY",
        "MARKETS",
        "AI",
        "SCIENCE",
        "ECONOMICS",
        "GEOPOLITICS",
        "OTHER",
      ])
        expect(
          contrast(categoryColour(category, light ? "light" : "dark"), token(bg, light)),
          category
        ).toBeGreaterThanOrEqual(4.5);
    }
  });
