/**
 * Instagram card image generator.
 *
 * Produces JPEG images sized for Instagram:
 *   - Daily cards: 1080×1350 (4:5 portrait — matches the profile grid's
 *     portrait tile so headlines aren't side-cropped, and gives more in-feed
 *     space when the post is opened)
 *   - Weekly edition cards: 1080×1350 (4:5 portrait, more content space)
 *
 * Uses the same satori → resvg → sharp pipeline as editionCard.ts, and
 * the same brand tokens (navy, amber, Playfair/JetBrains Mono). Instagram
 * requires JPEG for carousel uploads, not WebP or PNG.
 */
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import { seriesRange, sparklineDataUri, thin, type SparkPoint } from "./sparkline";
import type { StatFact } from "../metrics/statFacts";
import sharp from "sharp";
import type { DailyFeedItem, Edition } from "../db/schema";
import type { EditionTopic } from "../../shared/schemas";
import { weeklyFeatureTree } from "./weeklyFeature";

const FONT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fonts");

type LoadedFonts = {
  playfair: ArrayBuffer;
  mono: ArrayBuffer;
  sans: ArrayBuffer;
  italic: ArrayBuffer;
};
let cachedFonts: LoadedFonts | null = null;

async function loadFonts(): Promise<LoadedFonts> {
  if (cachedFonts) return cachedFonts;
  const [playfair, mono, sans, italic] = await Promise.all([
    fs.promises.readFile(path.join(FONT_DIR, "PlayfairDisplay-Bold.woff")),
    fs.promises.readFile(path.join(FONT_DIR, "JetBrainsMono-Regular.woff")),
    fs.promises.readFile(path.join(FONT_DIR, "DeskEditorialSans-Regular.woff")),
    fs.promises.readFile(path.join(FONT_DIR, "DeskEditorial-Italic.woff")),
  ]);
  cachedFonts = {
    italic: italic.buffer.slice(
      italic.byteOffset,
      italic.byteOffset + italic.byteLength
    ) as ArrayBuffer,
    sans: sans.buffer.slice(sans.byteOffset, sans.byteOffset + sans.byteLength) as ArrayBuffer,
    playfair: playfair.buffer.slice(
      playfair.byteOffset,
      playfair.byteOffset + playfair.byteLength
    ) as ArrayBuffer,
    mono: mono.buffer.slice(mono.byteOffset, mono.byteOffset + mono.byteLength) as ArrayBuffer,
  };
  return cachedFonts;
}

/** Same bundled font for burned-in Reel subtitles; no system-font dependency. */
export async function loadReelSubtitleFont(): Promise<Buffer> {
  return Buffer.from((await loadFonts()).mono);
}

/** A stable 9:16 scene canvas, with room for platform chrome and spoken subtitles. */
export async function renderEditorialFrame(
  content: object,
  variant: CardVariant,
  meta: {
    kicker: string;
    source: string;
    index: number;
    count: number;
    quiet?: boolean;
    documentary?: boolean;
  }
): Promise<Buffer> {
  const c = colorScheme(variant);
  const div = (style: object, children: unknown) => ({
    type: "div",
    props: { style: { display: "flex", ...style }, children },
  });
  const mono = (text: string, size: number, color: string) =>
    div({ fontFamily: "JetBrains Mono", fontSize: size, color }, text);
  const tree = div(
    {
      position: "relative",
      width: 1080,
      height: 1920,
      backgroundColor: meta.documentary && variant !== "light" ? "#0C1117" : c.bg,
    },
    [
      div(
        {
          position: "absolute",
          left: 84,
          top: 166,
          right: 156,
          alignItems: "center",
          justifyContent: "space-between",
        },
        [
          brandHeader(await loadLogo(variant), 48, { accent: c.amber }),
          ...(!meta.quiet
            ? [
                mono(
                  `${String(meta.index + 1).padStart(2, "0")} / ${String(meta.count).padStart(2, "0")}`,
                  22,
                  c.fgMuted
                ),
              ]
            : []),
        ]
      ),
      div(
        { position: "absolute", left: 84, top: 258 },
        mono(meta.kicker, 22, meta.quiet ? c.fgMuted : c.amber)
      ),
      div(
        { position: "absolute", left: 84, top: 355, width: 840, flexDirection: "column" },
        content
      ),
      div(
        {
          position: "absolute",
          left: 84,
          top: 1375,
          width: 840,
          ...(meta.quiet ? {} : { borderTop: `1px solid ${c.fgMuted}` }),
          paddingTop: 20,
        },
        mono(meta.source, 21, c.fgMuted)
      ),
      ...(!meta.quiet
        ? [
            div(
              {
                position: "absolute",
                left: 84,
                top: 1570,
                width: 840,
                height: 3,
                backgroundColor: c.amberSoft,
              },
              [
                div(
                  {
                    width: `${((meta.index + 1) / meta.count) * 100}%`,
                    height: 3,
                    backgroundColor: c.amber,
                  },
                  ""
                ),
              ]
            ),
          ]
        : []),
    ]
  );
  return renderToJpeg(tree, 1080, 1920);
}

/**
 * The Desk lockup (logo + wordmark), light colourway on transparent, copied
 * into the fonts dir so the build bundles it next to dist/. Loaded once as a
 * base64 data URI that satori can embed as an <img>. Putting the actual brand
 * mark on every card builds recognition far better than a text wordmark.
 */
// One lockup per grid variant: the standard (light-on-transparent) mark
// for navy cards, and the gold-on-transparent mark for the light/paper
// cards where the standard one would wash out.
const LOGO_FILE: Record<CardVariant, string> = {
  navy: "desk-lockup.png",
  light: "desk-lockup-on-light.png",
};
const cachedLogos: Partial<Record<CardVariant, string>> = {};
async function loadLogo(variant: CardVariant = "navy"): Promise<string | null> {
  if (cachedLogos[variant]) return cachedLogos[variant]!;
  try {
    const buf = await fs.promises.readFile(path.join(FONT_DIR, LOGO_FILE[variant]));
    const uri = `data:image/png;base64,${buf.toString("base64")}`;
    cachedLogos[variant] = uri;
    return uri;
  } catch (err) {
    // If the bundled logo can't be read (e.g. not copied into the build),
    // fall back to the text wordmark rather than failing the whole post.
    console.warn("[instagramCards] logo unavailable, using text wordmark:", (err as Error).message);
    return null;
  }
}

/** Load a bundled JPEG/PNG asset (hero photo, headshot) as a data URI,
 *  cached. Returns null if missing so a render never hard-fails. */
const cachedAssets: Record<string, string | null> = {};
export async function loadAsset(filename: string): Promise<string | null> {
  const cached = cachedAssets[filename];
  if (cached !== undefined) return cached;
  try {
    const buf = await fs.promises.readFile(path.join(FONT_DIR, filename));
    const mime = filename.endsWith(".png") ? "image/png" : "image/jpeg";
    const uri = `data:${mime};base64,${buf.toString("base64")}`;
    cachedAssets[filename] = uri;
    return uri;
  } catch (err) {
    console.warn(`[instagramCards] asset ${filename} unavailable:`, (err as Error).message);
    cachedAssets[filename] = null;
    return null;
  }
}

/** Header brand element: the logo lockup when available, else the text
 *  wordmark. Keeps a missing asset from ever blocking a post. */
function brandHeader(
  logo: string | null,
  height: number,
  opts?: { accent?: string; forceText?: boolean }
) {
  const accent = opts?.accent ?? AMBER;
  // On the light variant the white lockup PNG would vanish, so render the
  // text lockup in the (darkened) accent instead. A dedicated dark logo
  // asset would be the proper follow-up.
  if (logo && !opts?.forceText) {
    const width = Math.round(height * 3.226);
    return {
      type: "img",
      props: { src: logo, width, height, style: { width: `${width}px`, height: `${height}px` } },
    };
  }
  return {
    type: "div",
    props: {
      style: {
        fontFamily: "JetBrains Mono",
        fontSize: "15px",
        letterSpacing: "0.28em",
        textTransform: "uppercase",
        color: accent,
      },
      children: "The Desk · Daily Intelligence",
    },
  };
}

const NAVY = "#0C1220";
const AMBER = "#D4A853";
const FG = "#F0EDE8";
const FG_MUTED = "#9BA3B5";

/**
 * Grid theme for a card. The feed alternates navy/light per post so the
 * 3-wide Instagram profile grid reads as a checkerboard. "light" is not a
 * naive invert: the amber accent darkens so it stays legible on a pale
 * background, and the radial bloom / rules re-tune to the darker tone.
 */
export type CardVariant = "navy" | "light";

type Scheme = {
  bg: string;
  fg: string;
  fgMuted: string;
  amber: string;
  amberSoft: string;
  bloom: string;
  rule: string;
  ghost: string; // very low-opacity tone for the big watermark numeral
};

function colorScheme(variant: CardVariant): Scheme {
  if (variant === "light") {
    return {
      bg: "#F4F1EA", // warm paper, not stark white
      fg: "#14171F", // near-ink
      fgMuted: "#5A6072",
      amber: "#9A6B12", // deepened so it clears contrast on the pale bg
      amberSoft: "rgba(154,107,18,0.12)",
      bloom: "radial-gradient(circle at 85% 12%, rgba(154,107,18,0.10) 0%, transparent 52%)",
      rule: "linear-gradient(90deg, #9A6B12 0%, rgba(154,107,18,0) 70%)",
      ghost: "rgba(20,23,31,0.05)",
    };
  }
  return {
    bg: NAVY,
    fg: FG,
    fgMuted: FG_MUTED,
    amber: AMBER,
    amberSoft: "rgba(212,168,83,0.14)",
    bloom: "radial-gradient(circle at 85% 12%, rgba(212,168,83,0.13) 0%, transparent 52%)",
    rule: "linear-gradient(90deg, #D4A853 0%, rgba(212,168,83,0) 70%)",
    ghost: "rgba(212,168,83,0.10)",
  };
}

function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  // Cut on the last word boundary and add nothing — a trailing "…" reads as a
  // machine truncation. Fall back to a hard cut for unbroken strings.
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

/**
 * Clamp a block of prose so it never reads as chopped mid-sentence — the way a
 * card subtext "cuts off". Partner why-it-matters lines are short and pass
 * through untouched; the longer publisher summaries used as coverage subtext
 * are the ones that hit the cap. When we must trim, prefer ending on the last
 * complete sentence that fits, so the card reads as a finished thought. Only if
 * no sentence boundary lands in a sensible window do we fall back to a word-cut
 * with a trailing "…" to signal there's more, rather than a silent hard chop.
 */
function clampSentence(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const window = trimmed.slice(0, max);
  // Last sentence terminator (. ! ?) followed by a space or end-of-window.
  const sentenceEnd = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? ")
  );
  if (sentenceEnd > max * 0.5) {
    return window.slice(0, sentenceEnd + 1).trimEnd();
  }
  // No clean sentence break — cut on a word boundary and mark the elision so it
  // reads as deliberate continuation, not an accidental crop.
  const lastSpace = window.lastIndexOf(" ");
  const base = (lastSpace > max * 0.6 ? window.slice(0, lastSpace) : window).trimEnd();
  // A trim that lands on a clause-level mark (comma, semicolon, colon) reads as
  // a mid-sentence chop — strip it and elide. Only a real sentence terminator
  // (. ! ?) is a clean finish that needs no ellipsis.
  if (/[.!?]$/.test(base)) return base;
  return `${base.replace(/[,;:]+$/, "").trimEnd()}…`;
}

/**
 * Pick a font size so a full block of copy fits the card without truncation:
 * longer text steps down through the scale rather than being cut mid-sentence.
 * `tiers` are [maxChars, fontSize] pairs checked in order; the first whose
 * maxChars the text fits under wins, otherwise `fallback` (smallest) is used.
 */
function fitFontSize(len: number, tiers: Array<[number, string]>, fallback: string): string {
  for (const [max, size] of tiers) {
    if (len <= max) return size;
  }
  return fallback;
}

/**
 * Roughly how wide each character is in Playfair Display Bold, as a fraction of
 * the font size. Only the characters a figure can contain are listed; anything
 * else falls back to a digit's width.
 *
 * These are eyeballed from rendered output rather than read out of the font,
 * which is enough: the number they feed into is a *ceiling*, applied with a
 * safety margin, and the consequence of being slightly pessimistic is a figure
 * a few pixels smaller than it could have been.
 */
const GLYPH_EM: Record<string, number> = {
  "0": 0.56,
  "1": 0.42,
  "2": 0.56,
  "3": 0.56,
  "4": 0.56,
  "5": 0.56,
  "6": 0.56,
  "7": 0.56,
  "8": 0.56,
  "9": 0.56,
  ".": 0.28,
  ",": 0.28,
  " ": 0.26,
  $: 0.56,
  "%": 0.9,
  "-": 0.36,
  "\u2212": 0.36,
  "+": 0.6,
  b: 0.55,
  k: 0.55,
  m: 0.85,
  p: 0.55,
  s: 0.44,
};

/**
 * The largest size a figure can be set at and still fit on one line.
 *
 * Counting characters — which is what the rest of this file does, and what this
 * replaced for the 9:16 frame — is fine while the type is small enough that
 * even a pessimistic guess fits. It stops being fine once the figure is set as
 * large as a Reel needs: "12,480" and "-12.4pp" are both seven characters, and
 * the second is nearly a third wider, because a comma is a quarter of the width
 * of a "p". Sized by character count, one of them runs off the edge of the
 * frame — which is exactly what happened.
 *
 * So the width is estimated per glyph and the size falls out of the space
 * available. The 4 per cent margin is for the difference between these
 * approximations and the real font metrics.
 */
export function estimateValueEms(value: string): number {
  return [...value].reduce((n, ch) => n + (GLYPH_EM[ch] ?? GLYPH_EM["0"]!), 0);
}

export function fitValueSize(
  value: string,
  opts: { availablePx: number; maxPx: number; minPx: number }
): string {
  const ems = estimateValueEms(value);
  if (ems <= 0) return `${opts.maxPx}px`;
  const fits = (opts.availablePx * 0.96) / ems;
  // Floor rather than round: rounding up can put the line back over the width
  // the margin was there to protect.
  return `${Math.floor(Math.max(opts.minPx, Math.min(opts.maxPx, fits)))}px`;
}

async function renderToJpeg(tree: object, width: number, height: number): Promise<Buffer> {
  const fonts = await loadFonts();
  const svg = await satori(tree as never, {
    width,
    height,
    onNodeDetected: (node) => {
      const maxBottom = node.props["data-max-bottom"];
      if (typeof maxBottom === "number" && node.top + node.height > maxBottom)
        throw new Error("Weekly feature needs editorial review: body overlaps footer clearance");
    },
    fonts: [
      { name: "Desk Editorial Sans", data: fonts.sans, weight: 400, style: "normal" },
      { name: "Desk Editorial Italic", data: fonts.italic, weight: 500, style: "italic" },
      {
        name: "Playfair Display",
        data: fonts.playfair,
        weight: 700,
        style: "normal",
      },
      {
        name: "JetBrains Mono",
        data: fonts.mono,
        weight: 400,
        style: "normal",
      },
    ],
  });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
  const png = Buffer.from(resvg.render().asPng());
  // Fine film grain over the flat fills, so the cards read as printed
  // editorial stock rather than a flat export. A mid-grey gaussian noise
  // layer in 'overlay' leaves tones unchanged and only its deviations
  // nudge each pixel — subtle at sigma 7.
  const grain = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#808080",
      noise: { type: "gaussian", mean: 128, sigma: 7 },
    },
  })
    .png()
    .toBuffer();
  return sharp(png)
    .composite([{ input: grain, blend: "overlay" }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

/** The reviewed profile carousels use the same fonts and JPEG pipeline as daily posts. */
export async function renderLaunchSlide(
  slide: { title: string; body: string },
  series: string,
  index: number,
  count: number
): Promise<Buffer> {
  const el = (children: unknown, style: Record<string, unknown> = {}) => ({
    type: "div",
    props: { style: { display: "flex", ...style }, children },
  });
  return renderToJpeg(
    el(
      [
        el(
          [el("THE DESK", { color: "#D4A853", letterSpacing: "7px" }), el(`${index} / ${count}`)],
          {
            justifyContent: "space-between",
            fontSize: 22,
            fontFamily: "JetBrains Mono",
            color: "#929CAD",
          }
        ),
        el(
          [
            el(series.toUpperCase(), {
              fontFamily: "JetBrains Mono",
              fontSize: 20,
              color: "#D4A853",
              letterSpacing: "4px",
            }),
            el(slide.title, {
              fontFamily: "Playfair Display",
              fontSize: 90,
              lineHeight: 1.05,
              marginTop: 42,
              letterSpacing: "-3px",
            }),
            el(slide.body, {
              fontFamily: "Playfair Display",
              fontSize: 36,
              lineHeight: 1.5,
              color: "#BFC6D0",
              marginTop: 42,
            }),
          ],
          { flexDirection: "column" }
        ),
        el([el("THEDESK.AU"), el(index === count ? "OPEN THE DESK" : "SWIPE")], {
          justifyContent: "space-between",
          fontFamily: "JetBrains Mono",
          fontSize: 18,
          letterSpacing: "3px",
          borderTop: "1px solid #49505C",
          paddingTop: 25,
          color: "#929CAD",
        }),
      ],
      {
        width: 1080,
        height: 1350,
        background: "#0C1220",
        color: "#F0EDE8",
        padding: "76px",
        flexDirection: "column",
        justifyContent: "space-between",
      }
    ),
    1080,
    1350
  );
}

/**
 * Daily story card: 1080×1350 (4:5 portrait).
 * Displays one story per slide with category, headline, and why-it-matters.
 */
export async function renderDailyStoryCard(
  story: DailyFeedItem,
  slideIndex: number,
  slideTotal: number,
  variant: CardVariant = "navy",
  opts: { subtextLabel?: string } = {}
): Promise<Buffer> {
  const logo = await loadLogo(variant);
  const c = colorScheme(variant);
  const slideNum = String(slideIndex + 1).padStart(2, "0");
  const totalNum = String(slideTotal).padStart(2, "0");
  const headline = clamp(story.title, 90);
  // The subtext: a short partner "why it matters" passes through whole, while a
  // longer publisher summary (coverage "In Brief") is trimmed to its last
  // complete sentence so the card never reads as chopped mid-thought. Font
  // steps down with length so even a full block fits the card.
  const why = story.whyItMatters ? clampSentence(story.whyItMatters, 300) : null;
  const whyFontSize = why
    ? fitFontSize(
        why.length,
        [
          [150, "35px"],
          [220, "31px"],
          [280, "28px"],
        ],
        "26px"
      )
    : "35px";
  const category = (story.category || "NEWS").toUpperCase();
  const fontSize = headline.length > 64 ? "60px" : "74px";

  const tree = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "1080px",
        height: "1350px",
        backgroundColor: c.bg,
        backgroundImage: c.bloom,
        padding: "64px",
        justifyContent: "space-between",
      },
      children: [
        // ── Top: branding + slide counter ──
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            },
            children: [
              brandHeader(logo, 56, { accent: c.amber }),
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "JetBrains Mono",
                    fontSize: "15px",
                    letterSpacing: "0.15em",
                    color: c.fgMuted,
                  },
                  children: `${slideNum} / ${totalNum}`,
                },
              },
            ],
          },
        },

        // ── Middle: category + headline + why ──
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: "28px",
            },
            children: [
              // Category pill
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignSelf: "flex-start",
                    backgroundColor: c.amberSoft,
                    border: `1px solid ${c.amber}`,
                    borderRadius: "4px",
                    padding: "5px 14px",
                  },
                  children: {
                    type: "div",
                    props: {
                      style: {
                        fontFamily: "JetBrains Mono",
                        fontSize: "16px",
                        letterSpacing: "0.22em",
                        color: c.amber,
                      },
                      children: category,
                    },
                  },
                },
              },
              // Headline
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize,
                    lineHeight: 1.08,
                    letterSpacing: "-0.02em",
                    color: c.fg,
                  },
                  children: headline,
                },
              },
              // Why it matters
              ...(why
                ? [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                          borderLeft: `3px solid ${c.amber}`,
                          paddingLeft: "20px",
                        },
                        children: [
                          {
                            type: "div",
                            props: {
                              style: {
                                fontFamily: "JetBrains Mono",
                                fontSize: "17px",
                                letterSpacing: "0.25em",
                                textTransform: "uppercase",
                                color: c.amber,
                              },
                              children: opts.subtextLabel ?? "Why It Matters",
                            },
                          },
                          {
                            type: "div",
                            props: {
                              style: {
                                fontFamily: "JetBrains Mono",
                                fontSize: whyFontSize,
                                lineHeight: 1.5,
                                color: c.fgMuted,
                              },
                              children: why,
                            },
                          },
                        ],
                      },
                    },
                  ]
                : []),
            ],
          },
        },

        // ── Bottom: rule + source + domain ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "18px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    width: "100%",
                    height: "1px",
                    backgroundImage: c.rule,
                  },
                  children: "",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: "15px",
                          letterSpacing: "0.15em",
                          textTransform: "uppercase",
                          color: c.fgMuted,
                        },
                        children: `via ${clamp(story.source, 30)}`,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: "15px",
                          letterSpacing: "0.22em",
                          color: c.amber,
                        },
                        children: "thedesk.au",
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };

  return renderToJpeg(tree, 1080, 1350);
}

/**
 * Format a feed date ("YYYY-MM-DD") into a human briefing date, e.g.
 * "Tuesday, 3 June 2026". Parsed and formatted in UTC so the calendar date
 * is never shifted by the server timezone. Falls back to today if absent.
 */
function formatBriefingDate(feedDate?: string | null): string {
  const d = feedDate ? new Date(`${feedDate}T00:00:00Z`) : new Date();
  const date = Number.isNaN(d.getTime()) ? new Date() : d;
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Daily cover card: 1080×1350 (4:5 portrait), slide 1 of the daily carousel.
 *
 * A branded contents page — logo, date, "Today's Briefing", and the numbered
 * headlines of the stories that follow. Because Instagram's grid shows slide 1
 * as the post thumbnail, leading every daily post with this cover makes the
 * profile grid read as a cohesive column of covers instead of three dense,
 * unrelated story tiles. The 4:5 ratio fills that portrait grid tile so the
 * cover isn't side-cropped. Mirrors renderWeeklyCoverCard for the daily cadence.
 */
export async function renderDailyCoverCard(
  stories: DailyFeedItem[],
  feedDate?: string | null,
  variant: CardVariant = "navy",
  metrics?: Array<{ label: string; value: string }>,
  opts: { title?: string; kicker?: string; swipe?: string } = {}
): Promise<Buffer> {
  const logo = await loadLogo(variant);
  const c = colorScheme(variant);
  const dateLabel = formatBriefingDate(feedDate);
  const items = stories.slice(0, 3);
  // Day-of-month for the oversized watermark numeral that anchors the top
  // of the card and fills what used to be dead space.
  const d = feedDate ? new Date(`${feedDate}T00:00:00Z`) : new Date();
  const dayNum = String((Number.isNaN(d.getTime()) ? new Date() : d).getUTCDate()).padStart(2, "0");

  const tree = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "1080px",
        height: "1350px",
        backgroundColor: c.bg,
        backgroundImage: c.bloom,
        padding: "64px",
        position: "relative",
        justifyContent: "flex-start",
      },
      children: [
        // ── Oversized watermark numeral, bleeds off the top-right edge ──
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              top: "-78px",
              right: "36px",
              fontFamily: "Playfair Display",
              fontWeight: 700,
              fontSize: "460px",
              lineHeight: 1,
              letterSpacing: "-0.04em",
              color: c.ghost,
            },
            children: dayNum,
          },
        },

        // ── Top: branding + label ──
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            },
            children: [
              brandHeader(logo, 56, { accent: c.amber }),
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "JetBrains Mono",
                    fontSize: "15px",
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: c.amber,
                  },
                  children: opts.kicker ?? "Daily Briefing",
                },
              },
            ],
          },
        },

        // ── Top spacer centres the briefing block (date + title + contents +
        //    folded metric strip) between header and footer, so the slack
        //    splits evenly instead of stranding a gap above the footer. ──
        { type: "div", props: { style: { display: "flex", flexGrow: 1 }, children: "" } },

        // ── Centred briefing block ──
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: "34px",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "JetBrains Mono",
                    fontSize: "17px",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: c.fgMuted,
                  },
                  children: dateLabel,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize: "92px",
                    lineHeight: 1.0,
                    letterSpacing: "-0.02em",
                    color: c.fg,
                  },
                  children: opts.title ?? "Today's Briefing",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: "56px",
                    marginTop: "40px",
                  },
                  children: items.map((s, i) => ({
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "16px",
                      },
                      children: [
                        {
                          type: "div",
                          props: {
                            style: {
                              fontFamily: "JetBrains Mono",
                              fontSize: "15px",
                              color: c.amber,
                              minWidth: "30px",
                              marginTop: "12px",
                            },
                            children: `0${i + 1}`,
                          },
                        },
                        {
                          type: "div",
                          props: {
                            style: {
                              fontFamily: "Playfair Display",
                              fontWeight: 700,
                              fontSize: "46px",
                              lineHeight: 1.3,
                              color: c.fg,
                            },
                            children: clamp(s.title, 90),
                          },
                        },
                      ],
                    },
                  })),
                },
              },
              // ── Slim metric strip, folded directly under the contents so the
              //    dashboard reads as one group with the briefing rather than a
              //    detached lower third. Rendered only when given. ──
              ...(metrics && metrics.length
                ? [
                    {
                      type: "div",
                      props: {
                        style: { display: "flex", gap: "54px", marginTop: "44px" },
                        children: metrics.slice(0, 4).map((m) => ({
                          type: "div",
                          props: {
                            style: {
                              display: "flex",
                              flexDirection: "column",
                              gap: "7px",
                            },
                            children: [
                              {
                                type: "div",
                                props: {
                                  style: {
                                    fontFamily: "Playfair Display",
                                    fontWeight: 700,
                                    fontSize: "40px",
                                    lineHeight: 1,
                                    color: c.fg,
                                  },
                                  // Guard the row width: values are short by
                                  // nature, but a malformed long one must not
                                  // push the strip off the card.
                                  children: clamp(m.value, 12),
                                },
                              },
                              {
                                type: "div",
                                props: {
                                  style: {
                                    fontFamily: "JetBrains Mono",
                                    fontSize: "12px",
                                    letterSpacing: "0.18em",
                                    textTransform: "uppercase",
                                    color: c.amber,
                                  },
                                  children: clamp(m.label, 18),
                                },
                              },
                            ],
                          },
                        })),
                      },
                    },
                  ]
                : [
                    // No metric strip (e.g. the coverage carousel):
                    // reserve the strip's vertical footprint so the briefing
                    // block keeps the same height and the title/contents line up
                    // with the cover that does carry a strip. marginTop (44) +
                    // value (40) + gap (7) + label (~14) ≈ the rendered strip.
                    {
                      type: "div",
                      props: {
                        style: { display: "flex", marginTop: "44px", height: "61px" },
                        children: "",
                      },
                    },
                  ]),
            ],
          },
        },

        // ── Bottom spacer balances the top one to keep the block centred. ──
        { type: "div", props: { style: { display: "flex", flexGrow: 1 }, children: "" } },

        // ── Bottom: rule + swipe prompt + domain ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "18px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    width: "100%",
                    height: "1px",
                    backgroundImage: c.rule,
                  },
                  children: "",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: "15px",
                          letterSpacing: "0.15em",
                          textTransform: "uppercase",
                          color: c.fgMuted,
                        },
                        /**
                         * Name what the swipe actually buys. "Swipe for today's
                         * stories" promised the headlines this cover has already
                         * listed, so it asked for the swipe having spent the
                         * reason for it. The slides carry the analysis the cover
                         * withholds, and saying so is the open loop.
                         */
                        children: opts.swipe ?? "Swipe for why each one matters »",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: "15px",
                          letterSpacing: "0.22em",
                          color: c.amber,
                        },
                        children: "thedesk.au",
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };

  return renderToJpeg(tree, 1080, 1350);
}

/**
 * Daily Story frame: 1080×1920 (9:16), for the Instagram Story posted right
 * after the feed carousel. Spotlights the lead story, but wears the same
 * chrome as the daily cover/hero card — the oversized day-of-month watermark,
 * the logo + "Daily Briefing" header, the date line and the amber rule footer —
 * so the Story reads as the same system as the grid post it accompanies. Takes
 * the post's checkerboard `variant` so the Story matches the day's cover colour.
 */
export async function renderDailyStoryVertical(
  story: DailyFeedItem,
  variant: CardVariant = "navy",
  opts: { subtextLabel?: string; header?: string } = {}
): Promise<Buffer> {
  const logo = await loadLogo(variant);
  const c = colorScheme(variant);
  const headline = clamp(story.title, 100);
  // Same subtext treatment as the carousel card: short partner lines pass
  // through, longer coverage summaries trim to their last complete sentence so
  // the Story frame never shows a chopped-off subline. The taller 9:16 canvas
  // gives more room, so the steps are a touch larger.
  const why = story.whyItMatters ? clampSentence(story.whyItMatters, 320) : null;
  const whyFontSize = why
    ? fitFontSize(
        why.length,
        [
          [200, "34px"],
          [280, "30px"],
        ],
        "27px"
      )
    : "34px";
  const category = (story.category || "NEWS").toUpperCase();
  const fontSize = headline.length > 72 ? "76px" : "92px";
  const dateLabel = formatBriefingDate(story.feedDate);
  // Day-of-month for the oversized watermark numeral, the same anchor the
  // cover card uses to tie the two formats together.
  const d = story.feedDate ? new Date(`${story.feedDate}T00:00:00Z`) : new Date();
  const dayNum = String((Number.isNaN(d.getTime()) ? new Date() : d).getUTCDate()).padStart(2, "0");

  const tree = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "1080px",
        height: "1920px",
        backgroundColor: c.bg,
        backgroundImage: c.bloom,
        padding: "120px 80px",
        position: "relative",
        justifyContent: "space-between",
      },
      children: [
        // ── Oversized watermark numeral, bleeds off the top-right edge ──
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              top: "-30px",
              right: "40px",
              fontFamily: "Playfair Display",
              fontWeight: 700,
              fontSize: "460px",
              lineHeight: 1,
              letterSpacing: "-0.04em",
              color: c.ghost,
            },
            children: dayNum,
          },
        },

        // ── Top: branding + label + date ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "22px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  },
                  children: [
                    brandHeader(logo, 72, { accent: c.amber }),
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: "16px",
                          letterSpacing: "0.22em",
                          textTransform: "uppercase",
                          color: c.amber,
                        },
                        children: opts.header ?? "Daily Briefing",
                      },
                    },
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "JetBrains Mono",
                    fontSize: "17px",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: c.fgMuted,
                  },
                  children: dateLabel,
                },
              },
            ],
          },
        },

        // ── Middle: category + headline + why ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "36px" },
            children: [
              // Category pill
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignSelf: "flex-start",
                    backgroundColor: c.amberSoft,
                    border: `1px solid ${c.amber}`,
                    borderRadius: "4px",
                    padding: "6px 16px",
                  },
                  children: {
                    type: "div",
                    props: {
                      style: {
                        fontFamily: "JetBrains Mono",
                        fontSize: "18px",
                        letterSpacing: "0.22em",
                        color: c.amber,
                      },
                      children: category,
                    },
                  },
                },
              },
              // Headline
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize,
                    lineHeight: 1.08,
                    letterSpacing: "-0.02em",
                    color: c.fg,
                  },
                  children: headline,
                },
              },
              // Why it matters
              ...(why
                ? [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                          borderLeft: `3px solid ${c.amber}`,
                          paddingLeft: "24px",
                        },
                        children: [
                          {
                            type: "div",
                            props: {
                              style: {
                                fontFamily: "JetBrains Mono",
                                fontSize: "17px",
                                letterSpacing: "0.25em",
                                textTransform: "uppercase",
                                color: c.amber,
                              },
                              children: opts.subtextLabel ?? "Why It Matters",
                            },
                          },
                          {
                            type: "div",
                            props: {
                              style: {
                                fontFamily: "JetBrains Mono",
                                fontSize: whyFontSize,
                                lineHeight: 1.45,
                                color: c.fgMuted,
                              },
                              children: why,
                            },
                          },
                        ],
                      },
                    },
                  ]
                : []),
            ],
          },
        },

        // ── Bottom: feed prompt + rule + source + domain ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "28px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize: "30px",
                    lineHeight: 1.2,
                    color: c.fg,
                  },
                  children: "See today's top stories on our feed",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    width: "100%",
                    height: "1px",
                    backgroundImage: c.rule,
                  },
                  children: "",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: "13px",
                          letterSpacing: "0.15em",
                          textTransform: "uppercase",
                          color: c.fgMuted,
                        },
                        children: `via ${clamp(story.source, 30)}`,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: "13px",
                          letterSpacing: "0.22em",
                          color: c.amber,
                        },
                        children: "thedesk.au",
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };

  return renderToJpeg(tree, 1080, 1920);
}

/**
 * Weekly edition cover card: 1080×1350 portrait.
 * Leads with the first property finding, followed by a reading question and edition date.
 */
export async function renderWeeklyCoverCard(
  edition: Edition,
  _heroOverride?: string | null,
  variant: CardVariant = "navy"
): Promise<Buffer> {
  return renderToJpeg(
    weeklyFeatureTree(edition, colorScheme(variant), false, await loadLogo(variant)),
    1080,
    1350
  );
}

/** Same lead, date and palette in a Story-safe vertical composition. */
export async function renderWeeklyStoryVertical(
  edition: Edition,
  _heroOverride?: string | null,
  variant: CardVariant = "navy"
): Promise<Buffer> {
  return renderToJpeg(
    weeklyFeatureTree(edition, colorScheme(variant), true, await loadLogo(variant)),
    1080,
    1920
  );
}

/**
 * Weekly topic card: 1080×1350 portrait.
 * One card per topic — category, title, summary, key takeaway.
 */
export async function renderWeeklyTopicCard(
  topic: EditionTopic,
  slideIndex: number,
  slideTotal: number,
  variant: CardVariant = "navy"
): Promise<Buffer> {
  // Match the cover/Story tone so the whole weekly carousel is one colourway.
  const c = colorScheme(variant);
  const FG = c.fg;
  const FG_MUTED = c.fgMuted;
  const AMBER = c.amber;
  const slideNum = String(slideIndex + 1).padStart(2, "0");
  const totalNum = String(slideTotal).padStart(2, "0");
  // Every prose field is trimmed sentence-aware, never with a bare word-cut:
  // these are full sentences, so a hard clamp reads as chopped mid-thought
  // (the "not the", "pulling back," artefacts). clampSentence ends on a
  // complete sentence where one fits, else a clean word boundary + ellipsis.
  const why = topic.whyItMatters ? clampSentence(topic.whyItMatters, 190) : null;
  // Forward-looking watch items: the analytical payload that turns a bare
  // summary card into a briefing the reader keeps. Up to three, each trimmed
  // so it completes its thought or elides cleanly, on at most two lines.
  const watch = (topic.whatToWatch ?? [])
    .filter((w) => w && w.trim())
    .slice(0, 3)
    .map((w) => clampSentence(w, 120));
  const takeaway = topic.keyTakeaway ? clampSentence(topic.keyTakeaway, 185) : null;

  // How much analysis the topic actually ships. With at most one block the
  // card would dead-space, so we switch it to a "standfirst page": the lead
  // grows and the whole block is centred, turning empty space into deliberate
  // editorial breathing room rather than a hole above the folio.
  const analysisBlocks = (why ? 1 : 0) + (watch.length ? 1 : 0) + (takeaway ? 1 : 0);
  const sparse = analysisBlocks <= 1;
  const summary = clampSentence(topic.summary, sparse ? 320 : 240);
  const summaryFontSize = sparse ? "29px" : "23px";
  const summaryLineHeight = sparse ? 1.58 : 1.62;
  // On a standfirst page the title is the hero, so it scales right up; on a
  // dense card it stays measured to leave room for the analysis blocks.
  if (!topic.title.trim() || topic.title.length > 200)
    throw new Error("Weekly topic needs editorial review: headline outside layout limit");
  const titleFontSize =
    topic.title.length > 150
      ? "44px"
      : topic.title.length > 100
        ? "52px"
        : sparse
          ? topic.title.length > 55
            ? "68px"
            : "90px"
          : topic.title.length > 55
            ? "52px"
            : "62px";

  const tree = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "1080px",
        height: "1350px",
        backgroundColor: c.bg,
        backgroundImage: c.bloom,
        padding: "80px 72px",
        position: "relative",
        justifyContent: "space-between",
      },
      children: [
        // ── Oversized folio numeral, bleeds off the bottom-right edge. The
        //    same anchor the daily cover uses, so the weekly slides read as
        //    the same system and the lower third never sits empty. ──
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              bottom: "-96px",
              right: "32px",
              fontFamily: "Playfair Display",
              fontWeight: 700,
              fontSize: "440px",
              lineHeight: 1,
              letterSpacing: "-0.04em",
              color: c.ghost,
            },
            children: slideNum,
          },
        },

        // ── Top: branding + counter ──
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "JetBrains Mono",
                    fontSize: "24px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: AMBER,
                  },
                  children: "The Desk · Weekly",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "JetBrains Mono",
                    fontSize: "24px",
                    letterSpacing: "0.10em",
                    color: FG_MUTED,
                  },
                  children: `${slideNum} / ${totalNum}`,
                },
              },
            ],
          },
        },

        // ── Content fills the gap between header and footer, centred so any
        //    slack splits evenly top and bottom instead of dead-ending above
        //    the footer: the lead group sits over the analysis group. ──
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              flexGrow: 1,
              justifyContent: sparse ? "center" : "flex-start",
              gap: "46px",
              paddingTop: sparse ? "0px" : "52px",
              paddingBottom: sparse ? "40px" : "0px",
            },
            children: [
              // ── Upper: the lead (category, title, standfirst) ──
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: "30px",
                  },
                  children: [
                    // Category pill
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          alignSelf: "flex-start",
                          backgroundColor: c.amberSoft,
                          border: `1px solid ${AMBER}`,
                          borderRadius: "4px",
                          padding: "6px 16px",
                        },
                        children: {
                          type: "div",
                          props: {
                            style: {
                              fontFamily: "JetBrains Mono",
                              fontSize: "24px",
                              letterSpacing: "0.12em",
                              textTransform: "uppercase",
                              color: AMBER,
                            },
                            children: (topic.category || "ANALYSIS").toUpperCase(),
                          },
                        },
                      },
                    },
                    // Title
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "Playfair Display",
                          fontWeight: 700,
                          fontSize: titleFontSize,
                          lineHeight: 1.08,
                          letterSpacing: "-0.025em",
                          color: FG,
                        },
                        children: topic.title.trim(),
                      },
                    },
                    // Summary (the lead / standfirst — grows when it carries
                    // the card alone)
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: summaryFontSize,
                          lineHeight: summaryLineHeight,
                          color: FG,
                        },
                        children: summary,
                      },
                    },
                    // Why it matters — the audience-focus sentence, set off with a
                    // rule so it reads as analysis, not more of the lead.
                    ...(why
                      ? [
                          {
                            type: "div",
                            props: {
                              style: {
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                                borderLeft: `3px solid ${AMBER}`,
                                paddingLeft: "22px",
                              },
                              children: [
                                {
                                  type: "div",
                                  props: {
                                    style: {
                                      fontFamily: "JetBrains Mono",
                                      fontSize: "24px",
                                      letterSpacing: "0.12em",
                                      textTransform: "uppercase",
                                      color: AMBER,
                                    },
                                    children: "Before You Act",
                                  },
                                },
                                {
                                  type: "div",
                                  props: {
                                    style: {
                                      fontFamily: "JetBrains Mono",
                                      fontSize: sparse ? "28px" : "21px",
                                      lineHeight: 1.5,
                                      color: FG_MUTED,
                                    },
                                    children: why,
                                  },
                                },
                              ],
                            },
                          },
                        ]
                      : []),
                  ],
                },
              },

              // ── Lower: the analysis (what to watch + key takeaway). Held as its
              //    own group so the page's space-between pushes it into the lower
              //    third, filling the card instead of leaving dead space. ──
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: "26px",
                  },
                  children: [
                    // What to watch — forward-looking checklist that gives the card
                    // genuine reader value.
                    ...(watch.length
                      ? [
                          {
                            type: "div",
                            props: {
                              style: {
                                display: "flex",
                                flexDirection: "column",
                                gap: "14px",
                              },
                              children: [
                                {
                                  type: "div",
                                  props: {
                                    style: {
                                      fontFamily: "JetBrains Mono",
                                      fontSize: "11px",
                                      letterSpacing: "0.25em",
                                      textTransform: "uppercase",
                                      color: AMBER,
                                    },
                                    children: "What To Watch",
                                  },
                                },
                                ...watch.map((item) => ({
                                  type: "div",
                                  props: {
                                    style: {
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: "14px",
                                    },
                                    children: [
                                      {
                                        type: "div",
                                        props: {
                                          style: {
                                            fontFamily: "JetBrains Mono",
                                            fontSize: "21px",
                                            lineHeight: 1.4,
                                            color: AMBER,
                                          },
                                          children: "›",
                                        },
                                      },
                                      {
                                        type: "div",
                                        props: {
                                          style: {
                                            fontFamily: "JetBrains Mono",
                                            fontSize: "20px",
                                            lineHeight: 1.4,
                                            color: FG,
                                          },
                                          children: item,
                                        },
                                      },
                                    ],
                                  },
                                })),
                              ],
                            },
                          },
                        ]
                      : []),
                    // Key takeaway box — the line Ruben repeats verbatim, kept as
                    // the emphasized closer of the card.
                    ...(takeaway
                      ? [
                          {
                            type: "div",
                            props: {
                              style: {
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                                backgroundColor: "rgba(212,168,83,0.07)",
                                borderRadius: "8px",
                                padding: "26px",
                                border: "1px solid rgba(212,168,83,0.22)",
                              },
                              children: [
                                {
                                  type: "div",
                                  props: {
                                    style: {
                                      fontFamily: "JetBrains Mono",
                                      fontSize: "10px",
                                      letterSpacing: "0.25em",
                                      textTransform: "uppercase",
                                      color: AMBER,
                                    },
                                    children: "Key Takeaway",
                                  },
                                },
                                {
                                  type: "div",
                                  props: {
                                    style: {
                                      fontFamily: "JetBrains Mono",
                                      fontSize: "21px",
                                      lineHeight: 1.5,
                                      color: FG,
                                    },
                                    children: takeaway,
                                  },
                                },
                              ],
                            },
                          },
                        ]
                      : []),
                  ],
                },
              },
            ],
          },
        },

        // ── Bottom: rule + domain ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "16px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    width: "100%",
                    height: "1px",
                    backgroundImage: `linear-gradient(90deg, ${AMBER} 0%, rgba(212,168,83,0) 70%)`,
                  },
                  children: "",
                },
              },
              {
                type: "div",
                props: {
                  style: { display: "flex", justifyContent: "flex-end" },
                  children: {
                    type: "div",
                    props: {
                      style: {
                        fontFamily: "JetBrains Mono",
                        fontSize: "24px",
                        letterSpacing: "0.02em",
                        color: AMBER,
                      },
                      children: topic.socialSource
                        ? `Source: ${topic.socialSource.publisher} · Feed date: ${topic.socialSource.feedDate} · Link in caption`
                        : "thedesk.au",
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  };

  return renderToJpeg(tree, 1080, 1350);
}

/**
 * Stat card: 1080×1350 (4:5 portrait), a single-image post.
 *
 * The inverse of the daily cover's information hierarchy. The cover leads with
 * a headline and demotes the figure to body text; this leads with the figure,
 * set as large as it will go, and demotes everything else. One number, one
 * sentence, one sourced claim, no swipe.
 *
 * `line` is the sentence from `generateStatLine` (already verified against the
 * source facts) and `subtext` is the computed claim from `pickStatOfTheDay` —
 * the only two pieces of prose on the card, and neither may say anything the
 * metric history does not support.
 */
export async function renderStatCard(
  stat: {
    label: string;
    value: string;
    line: string;
    subtext: string;
    source?: string | null;
    asOf?: Date | null;
    /**
     * The metric's own readings, oldest first. Drawn as a spare line under the
     * claim — the one thing on this card a competitor aggregating today's
     * headlines cannot print, because it is months of readings rather than a
     * figure. 9:16 only: the grid card has no room for it, and restyling every
     * stat post already published to add one is not worth it.
     */
    series?: SparkPoint[];
  },
  variant: CardVariant = "navy",
  opts: {
    kicker?: string;
    /** 4:5 grid card (default) or 9:16 for a Story or a Reel frame. */
    shape?: "feed" | "vertical";
    /**
     * How much of the card has arrived, 0..1. Used to render the frames of a
     * Reel from this same design rather than a second one: the number lands
     * first, the sentence follows, the claim last. At 1 (the default) the card
     * is whole, which is what every still rendering wants.
     */
    reveal?: number;
    /**
     * Show this in place of the real figure. Used only by the count-up in a
     * Reel, where the number climbs to itself. The type size is still chosen
     * from the *real* value's length, so an intermediate tick cannot resize the
     * hero and make the card jump under it.
     */
    valueText?: string;
    /** 0..1, how much of `stat.series` has been drawn. Animated by the Reel. */
    seriesProgress?: number;
    /**
     * Supporting figures from `buildStatFacts`, printed under the claim. This
     * is the density lever: their best-performing Reel puts seven specific
     * numbers on screen and ours put one. 9:16 only — there is no room on the
     * grid card and no reason to restyle posts already published.
     */
    facts?: StatFact[];
    /** How many of those have arrived. They appear one at a time, which is
     *  what makes the middle of the clip move without anything sliding. */
    factsShown?: number;
    /** Reserve a band below branding for spoken subtitles, Reel frames only. */
    subtitleSpace?: boolean;
  } = {}
): Promise<Buffer> {
  const logo = await loadLogo(variant);
  const c = colorScheme(variant);
  const vertical = opts.shape === "vertical";
  const width = 1080;
  const height = vertical ? 1920 : 1350;
  const reveal = opts.reveal ?? 1;
  // Each element appears at its own point in the reveal, in reading order.
  const showValue = reveal >= 0.15;
  const showLine = reveal >= 0.45;
  const showClaim = reveal >= 0.75;

  // The value is the whole point of the card, so it is set as large as its own
  // length allows rather than at a fixed size: "64.2%" earns 300px, "$815,439"
  // has to come down to stay on one line inside the 64px gutters.
  //
  // The 9:16 frame gets its own, larger scale. It is not a taller version of
  // the grid card: it is watched at arm's length in a feed of full-screen
  // video, against a competitor whose clips fill the frame. Type set for a
  // thumbnail reads as an empty poster at that size. Both tables are tuned to
  // the same constraint — the longest value at each step still clears the 64px
  // gutters on one line — so nothing here can wrap.
  //
  // Only the 9:16 frame is measured. The grid card's table is left alone: its
  // sizes are conservative enough that even the widest realistic figure clears
  // the gutters, and changing them would restyle every stat post already
  // published to fix a problem the grid card does not have.
  const valueSize = vertical
    ? fitValueSize(stat.value, { availablePx: width - 128, maxPx: 400, minPx: 120 })
    : fitFontSize(
        stat.value.length,
        [
          [5, "300px"],
          [7, "240px"],
          [9, "186px"],
          [12, "146px"],
        ],
        "112px"
      );
  const lineSize = fitFontSize(
    stat.line.length,
    vertical
      ? [
          [48, "68px"],
          [70, "59px"],
          [92, "51px"],
        ]
      : [
          [48, "54px"],
          [70, "47px"],
          [92, "41px"],
        ],
    vertical ? "45px" : "36px"
  );

  const asOfLabel = stat.asOf
    ? new Intl.DateTimeFormat("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Australia/Sydney",
      }).format(stat.asOf)
    : null;
  const provenance = [stat.source, asOfLabel].filter(Boolean).join(" · ");

  // A line needs a shape to be worth drawing. Two readings is a slope, not a
  // history, and drawing one would claim an archive that is not there.
  const points = vertical ? thin(stat.series ?? [], 60) : [];
  const chart =
    points.length >= 6
      ? {
          uri: sparklineDataUri(
            points.map((p) => p.value),
            {
              width: width - 128,
              height: 215,
              progress: opts.seriesProgress ?? 1,
              stroke: c.fg,
              accent: c.amber,
            }
          ),
          width: width - 128,
          height: 215,
          caption: `${points.length} readings`.toUpperCase(),
        }
      : null;

  // The slug: format, source, and how far back the readings go. The shape
  // Glasshouse puts at the top of every frame of theirs, because it establishes
  // in one line that there is an archive behind the number. Ours can only claim
  // it when it is true, so it appears only when a history is actually drawn and
  // states exactly the range of what is drawn.
  const slug =
    vertical && chart
      ? [opts.kicker ?? "The Number", stat.source, seriesRange(points)]
          .filter(Boolean)
          .join("  ·  ")
          .toUpperCase()
      : null;

  const facts = vertical ? (opts.facts ?? []) : [];
  const factsShown = opts.factsShown ?? facts.length;

  const tree = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: c.bg,
        backgroundImage: c.bloom,
        padding: "64px",
        // Instagram lays its caption, handle and buttons over roughly the
        // bottom fifth of a Reel. Reserving that as padding — rather than as a
        // heavier spacer — keeps the *whole* card, provenance line included,
        // above the chrome instead of only the headline.
        paddingBottom: vertical ? "268px" : "64px",
        justifyContent: "flex-start",
      },
      children: [
        // ── Top: branding + format name ──
        {
          type: "div",
          props: {
            style: { display: "flex", justifyContent: "space-between", alignItems: "center" },
            children: [
              brandHeader(logo, 56, { accent: c.amber }),
              // On the 9:16 frame the slug below already names the format, and
              // printing it twice in two weights reads as a mistake.
              ...(slug
                ? []
                : [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: "15px",
                          letterSpacing: "0.22em",
                          textTransform: "uppercase",
                          color: c.amber,
                        },
                        children: opts.kicker ?? "The Number",
                      },
                    },
                  ]),
            ],
          },
        },

        ...(opts.subtitleSpace && vertical
          ? [
              {
                type: "div",
                props: { style: { display: "flex", height: "160px", flexShrink: 0 }, children: "" },
              },
            ]
          : []),

        ...(slug
          ? [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontFamily: "JetBrains Mono",
                    fontSize: "16px",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: c.fgMuted,
                    marginTop: "30px",
                    // The block below it starts here now that the card is full
                    // enough to have collapsed its spacers, so the separation
                    // has to be explicit rather than left to the layout.
                    marginBottom: "30px",
                  },
                  children: slug,
                },
              },
            ]
          : []),

        // Spacers above and below place the stat block.
        //
        // On the 4:5 grid card the top one is heavier, which settles the block
        // into the lower third: the number is visually top-heavy, so
        // dead-centring it reads as sitting high.
        //
        // The 9:16 frame is near-balanced, weighted a touch upwards for the
        // same top-heaviness. An earlier version pushed the block right up
        // against the header to clear Instagram's chrome, which left almost
        // half the frame empty below it — the chrome is handled by the padding
        // above, so this only has to place the block.
        {
          type: "div",
          props: { style: { display: "flex", flexGrow: vertical ? 1 : 1.7 }, children: "" },
        },

        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column" },
            children: [
              // Metric name, small and quiet — the number below is the headline.
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "JetBrains Mono",
                    fontSize: "17px",
                    letterSpacing: "0.28em",
                    textTransform: "uppercase",
                    color: c.fgMuted,
                    marginBottom: "26px",
                  },
                  children: clamp(stat.label, 40),
                },
              },
              // The hero.
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize: valueSize,
                    lineHeight: 1.0,
                    // Only lightly tightened: at these sizes the usual display
                    // tracking pulls a leading "$" into the first digit and
                    // closes up the thousands comma.
                    letterSpacing: "-0.018em",
                    color: c.fg,
                    opacity: showValue ? 1 : 0,
                  },
                  children: opts.valueText ?? stat.value,
                },
              },
              // The sentence.
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize: lineSize,
                    lineHeight: 1.28,
                    letterSpacing: "-0.01em",
                    color: c.fg,
                    marginTop: "62px",
                    opacity: showLine ? 1 : 0,
                  },
                  children: clampSentence(stat.line, 100),
                },
              },
              // Short amber rule separating the sentence from the sourced claim,
              // so the mono line below reads as evidence rather than more prose.
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    width: "132px",
                    height: "2px",
                    backgroundColor: c.amber,
                    marginTop: "44px",
                    marginBottom: "26px",
                    opacity: showClaim ? 1 : 0,
                  },
                  children: "",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "JetBrains Mono",
                    fontSize: "19px",
                    letterSpacing: "0.16em",
                    lineHeight: 1.5,
                    textTransform: "uppercase",
                    color: c.amber,
                    opacity: showClaim ? 1 : 0,
                  },
                  children: clamp(stat.subtext, 92),
                },
              },
            ],
          },
        },

        // The supporting figures, one at a time. A mono figure over a small
        // caption, with a marker: the pattern their scan uses, and the reason
        // four numbers read as a reference rather than as a wall.
        ...(facts.length
          ? [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    marginTop: "42px",
                    gap: "20px",
                  },
                  children: facts.map((fact, i) => ({
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "20px",
                        opacity: i < factsShown ? 1 : 0,
                      },
                      children: [
                        {
                          type: "div",
                          props: {
                            style: {
                              display: "flex",
                              width: "10px",
                              height: "10px",
                              borderRadius: "5px",
                              backgroundColor: c.amber,
                              marginTop: "18px",
                            },
                            children: "",
                          },
                        },
                        {
                          type: "div",
                          props: {
                            style: { display: "flex", flexDirection: "column" },
                            children: [
                              {
                                type: "div",
                                props: {
                                  style: {
                                    fontFamily: "JetBrains Mono",
                                    fontSize: "42px",
                                    color: c.fg,
                                  },
                                  children: clamp(fact.figure, 26),
                                },
                              },
                              {
                                type: "div",
                                props: {
                                  style: {
                                    fontFamily: "JetBrains Mono",
                                    fontSize: "16px",
                                    letterSpacing: "0.16em",
                                    textTransform: "uppercase",
                                    color: c.fgMuted,
                                    marginTop: "10px",
                                  },
                                  children: clamp(fact.caption, 44),
                                },
                              },
                            ],
                          },
                        },
                      ],
                    },
                  })),
                },
              },
            ]
          : []),

        // The history, under the claim. It appears with the sentence rather than
        // with the figure: the number is the news, the line is the argument for
        // why it is news, and showing both at once gives the eye nowhere to go.
        ...(chart
          ? [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    marginTop: "54px",
                    marginBottom: "26px",
                    opacity: showLine ? 1 : 0,
                  },
                  children: [
                    {
                      type: "img",
                      props: { src: chart.uri, width: chart.width, height: chart.height },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: "17px",
                          letterSpacing: "0.2em",
                          textTransform: "uppercase",
                          color: c.fgMuted,
                          marginTop: "18px",
                        },
                        children: chart.caption,
                      },
                    },
                  ],
                },
              },
            ]
          : []),

        {
          type: "div",
          props: { style: { display: "flex", flexGrow: vertical ? 0.95 : 1 }, children: "" },
        },

        // ── Bottom: rule + provenance + domain ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "18px" },
            children: [
              {
                type: "div",
                props: {
                  style: { display: "flex", width: "100%", height: "1px", backgroundImage: c.rule },
                  children: "",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: "15px",
                          letterSpacing: "0.15em",
                          textTransform: "uppercase",
                          color: c.fgMuted,
                        },
                        // Naming the source on the card is the whole credibility
                        // position for this format: our numbers are checkable.
                        children: provenance || "The Desk",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: "15px",
                          letterSpacing: "0.22em",
                          color: c.amber,
                        },
                        children: "thedesk.au",
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };

  return renderToJpeg(tree, width, height);
}
