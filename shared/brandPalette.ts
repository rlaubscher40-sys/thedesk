/**
 * The light-theme palette, as resolved hex.
 *
 * `client/src/index.css` is the authority for the product's colour: the
 * `.light` block there declares every token in oklch, and the app reads them
 * as CSS custom properties. Three surfaces can't do that:
 *
 *   · email (server/core/mailer.ts) — no custom properties, no cascade
 *   · OG share cards (server/og/editionCard.ts) — satori resolves styles
 *     itself and never sees a stylesheet
 *   · the unsubscribe page (server/core/unsubscribeRoute.ts) — served
 *     standalone, without the React bundle
 *
 * Each of those used to carry its own hand-copied hex, which meant retuning
 * a token in index.css silently drifted them apart. They now share this
 * module, and `brandPalette.test.ts` parses the `.light` block and fails if
 * the values below stop matching it — so drift is a red test rather than a
 * visual bug someone notices in an inbox six weeks later.
 *
 * Declared in oklch (mirroring the CSS) and converted here, rather than
 * stored as hex, so the numbers are diffable against the stylesheet by eye.
 */

/** oklch → sRGB hex, via OKLab. Matrices from Ottosson's reference. */
export function oklchToHex(l: number, c: number, hDeg: number): string {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const lc = l_ ** 3;
  const mc = m_ ** 3;
  const sc = s_ ** 3;

  const r = 4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc;
  const g = -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc;
  const bl = -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc;

  return `#${[r, g, bl].map(encodeChannel).join("")}`;
}

/** Linear-light channel → gamma-encoded 8-bit hex pair. */
function encodeChannel(u: number): string {
  const enc =
    u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(Math.max(u, 0), 1 / 2.4) - 0.055;
  const byte = Math.round(Math.min(1, Math.max(0, enc)) * 255);
  return byte.toString(16).padStart(2, "0").toUpperCase();
}

/**
 * Flatten a black-alpha value over an opaque background.
 *
 * The CSS borders are `oklch(0 0 0 / 12%)` — alpha over whatever is behind
 * them. Email clients and satori are far happier with a solid value, so the
 * hairlines are pre-composited against the paper canvas.
 */
export function flattenBlackAlpha(hexBg: string, alpha: number): string {
  const n = Number.parseInt(hexBg.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return `#${channels
    .map((ch) => Math.round(ch * (1 - alpha)).toString(16).padStart(2, "0").toUpperCase())
    .join("")}`;
}

/** `rgba()` string for a hex colour at a given alpha. */
export function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * Light-theme tokens in oklch, mirroring the `.light` block of index.css.
 * Keyed by the CSS custom property they correspond to — the test asserts
 * that mapping holds.
 */
export const LIGHT_OKLCH = {
  "--color-bg": [0.965, 0.006, 82],
  "--color-bg-elevated": [0.995, 0.003, 82],
  "--color-bg-deep": [0.92, 0.006, 82],
  "--color-fg": [0.16, 0.018, 260],
  "--color-fg-body": [0.22, 0.015, 260],
  "--color-fg-muted": [0.4, 0.015, 260],
  "--color-fg-subtle": [0.42, 0.015, 260],
  "--color-accent-text": [0.54, 0.16, 55],
} as const satisfies Record<string, readonly [number, number, number]>;

const hex = (token: keyof typeof LIGHT_OKLCH): string =>
  oklchToHex(...(LIGHT_OKLCH[token] as unknown as [number, number, number]));

/**
 * The palette the off-app surfaces render with. Names are semantic rather
 * than token-shaped, because these are consumed as literal style values.
 */
export const BRAND_LIGHT = {
  /** Page canvas — the sheet itself. */
  paper: hex("--color-bg"),
  /** Elevated surface, a shade above the canvas. */
  paperRaised: hex("--color-bg-elevated"),
  /** One step below the canvas — the desk a sheet sits on. */
  paperDeep: hex("--color-bg-deep"),
  /** Ink: headlines, the brand mark, solid CTA fills. */
  ink: hex("--color-fg"),
  /** Long-form prose ink. */
  body: hex("--color-fg-body"),
  /** Labels and metadata. */
  muted: hex("--color-fg-muted"),
  /** Fine print. */
  subtle: hex("--color-fg-subtle"),
  /** Brand accent for overlines, eyebrows and links on paper. */
  accent: hex("--color-accent-text"),
} as const;

/** Hairline, pre-composited over the paper canvas. */
export const BRAND_LIGHT_BORDER = flattenBlackAlpha(BRAND_LIGHT.paper, 0.12);
/** Band / folio edge, pre-composited over the paper canvas. */
export const BRAND_LIGHT_BORDER_STRONG = flattenBlackAlpha(BRAND_LIGHT.paper, 0.22);
/** Tint behind a Say This plate or an error block. */
export const BRAND_LIGHT_ACCENT_SOFT = withAlpha(BRAND_LIGHT.accent, 0.07);
