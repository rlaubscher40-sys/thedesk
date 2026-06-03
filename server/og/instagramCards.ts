/**
 * Instagram card image generator.
 *
 * Produces JPEG images sized for Instagram:
 *   - Daily story cards: 1080×1080 (square, optimal for feed carousels)
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
import sharp from "sharp";
import type { DailyFeedItem, Edition } from "../db/schema";
import type { EditionTopic } from "../../shared/schemas";

const FONT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fonts");

type LoadedFonts = { playfair: ArrayBuffer; mono: ArrayBuffer };
let cachedFonts: LoadedFonts | null = null;

async function loadFonts(): Promise<LoadedFonts> {
  if (cachedFonts) return cachedFonts;
  const [playfair, mono] = await Promise.all([
    fs.promises.readFile(path.join(FONT_DIR, "PlayfairDisplay-Bold.woff")),
    fs.promises.readFile(path.join(FONT_DIR, "JetBrainsMono-Regular.woff")),
  ]);
  cachedFonts = {
    playfair: playfair.buffer.slice(
      playfair.byteOffset,
      playfair.byteOffset + playfair.byteLength
    ) as ArrayBuffer,
    mono: mono.buffer.slice(mono.byteOffset, mono.byteOffset + mono.byteLength) as ArrayBuffer,
  };
  return cachedFonts;
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
async function loadAsset(filename: string): Promise<string | null> {
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
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
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

async function renderToJpeg(tree: object, width: number, height: number): Promise<Buffer> {
  const fonts = await loadFonts();
  const svg = await satori(tree as never, {
    width,
    height,
    fonts: [
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

/**
 * Daily story card: 1080×1080 square.
 * Displays one story per slide with category, headline, and why-it-matters.
 */
export async function renderDailyStoryCard(
  story: DailyFeedItem,
  slideIndex: number,
  slideTotal: number,
  variant: CardVariant = "navy"
): Promise<Buffer> {
  const logo = await loadLogo(variant);
  const c = colorScheme(variant);
  const slideNum = String(slideIndex + 1).padStart(2, "0");
  const totalNum = String(slideTotal).padStart(2, "0");
  const headline = clamp(story.title, 90);
  // Show the full sentence — never cut "why it matters" mid-word. Upstream
  // generation caps this at 320 chars; the clamp here is only a last-resort
  // guard against pathological lengths. Font scales down so it always fits.
  const why = story.whyItMatters ? clamp(story.whyItMatters, 320) : null;
  const whyFontSize = why
    ? fitFontSize(
        why.length,
        [
          [150, "30px"],
          [220, "26px"],
        ],
        "23px"
      )
    : "30px";
  const category = (story.category || "NEWS").toUpperCase();
  const fontSize = headline.length > 64 ? "60px" : "74px";

  const tree = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "1080px",
        height: "1080px",
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
                                fontSize: "15px",
                                letterSpacing: "0.25em",
                                textTransform: "uppercase",
                                color: c.amber,
                              },
                              children: "Why It Matters",
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

  return renderToJpeg(tree, 1080, 1080);
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
 * Daily cover card: 1080×1080 square, slide 1 of the daily carousel.
 *
 * A branded contents page — logo, date, "Today's Briefing", and the numbered
 * headlines of the stories that follow. Because Instagram's grid shows slide 1
 * as the post thumbnail, leading every daily post with this cover makes the
 * profile grid read as a cohesive column of covers instead of three dense,
 * unrelated story tiles. Mirrors renderWeeklyCoverCard for the daily cadence.
 */
export async function renderDailyCoverCard(
  stories: DailyFeedItem[],
  feedDate?: string | null,
  variant: CardVariant = "navy",
  metrics?: Array<{ label: string; value: string }>
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
        height: "1080px",
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
                  children: "Daily Briefing",
                },
              },
            ],
          },
        },

        // ── Content: date + title + contents, pulled up under the header ──
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: "34px",
              marginTop: "76px",
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
                  children: "Today's Briefing",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: "34px",
                    marginTop: "16px",
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
                              fontSize: "40px",
                              lineHeight: 1.26,
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
            ],
          },
        },

        // Push the footer to the bottom edge; the content sits up top.
        { type: "div", props: { style: { display: "flex", flexGrow: 1 }, children: "" } },

        // ── Metric strip: a mini briefing dashboard that earns the lower
        //    third instead of leaving it empty. Rendered only when given. ──
        ...(metrics && metrics.length
          ? [
              {
                type: "div",
                props: {
                  style: { display: "flex", gap: "54px", marginBottom: "30px" },
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
                            children: m.value,
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
                            children: m.label,
                          },
                        },
                      ],
                    },
                  })),
                },
              },
            ]
          : []),

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
                        children: "Swipe for today's stories »",
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

  return renderToJpeg(tree, 1080, 1080);
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
  variant: CardVariant = "navy"
): Promise<Buffer> {
  const logo = await loadLogo(variant);
  const c = colorScheme(variant);
  const headline = clamp(story.title, 100);
  // Show the full sentence — never cut "why it matters" mid-word. The 320-char
  // clamp is only a last-resort guard; font scales down so it always fits.
  const why = story.whyItMatters ? clamp(story.whyItMatters, 320) : null;
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
                        children: "Daily Briefing",
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
                              children: "Why It Matters",
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
 * Shows edition number, week range, and topic list as a contents page.
 */
export async function renderWeeklyCoverCard(
  edition: Edition,
  heroOverride?: string | null
): Promise<Buffer> {
  const logo = await loadLogo("navy");
  // The edition's own AI-generated hero (a dark, no-text, category-matched
  // image, see editionHeroPrompt) when the posting flow supplies it as a data
  // URI, else the bundled fallback so a render never depends on a generated
  // asset existing.
  const hero = heroOverride ?? (await loadAsset("hero-weekly.jpg"));
  const headshot = await loadAsset("ruben.jpg");
  const topics = edition.topics.slice(0, 4);
  const metrics = edition.keyMetrics as Record<string, string | undefined> | null | undefined;
  const cashRate = metrics?.cashRate ?? metrics?.cash_rate ?? null;
  const asx = metrics?.asx200 ?? metrics?.ASX200 ?? metrics?.asx ?? null;
  const metricsLine =
    cashRate && asx
      ? `Cash Rate ${cashRate} · ASX 200 ${asx}`
      : cashRate
        ? `Cash Rate ${cashRate}`
        : "The full edition is on our feed";

  const tree = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "1080px",
        height: "1350px",
        backgroundColor: NAVY,
        position: "relative",
        padding: "80px 72px",
        justifyContent: "space-between",
      },
      children: [
        // ── Photographic hero behind everything ──
        hero
          ? {
              type: "div",
              props: {
                style: {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "1080px",
                  height: "1350px",
                  display: "flex",
                  backgroundImage: `url(${hero})`,
                  backgroundSize: "1080px 1350px",
                  backgroundPosition: "center",
                },
                children: "",
              },
            }
          : { type: "div", props: { style: { display: "flex" }, children: "" } },
        // Navy veil for legibility — heavier toward the bottom where the
        // type sits, lifting toward the top so the photo breathes.
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              width: "1080px",
              height: "1350px",
              display: "flex",
              backgroundImage:
                "linear-gradient(180deg, rgba(12,18,32,0.46) 0%, rgba(12,18,32,0.72) 46%, rgba(12,18,32,0.94) 100%)",
            },
            children: "",
          },
        },
        // Amber bloom, top-right.
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              width: "1080px",
              height: "1350px",
              display: "flex",
              backgroundImage:
                "radial-gradient(circle at 80% 10%, rgba(212,168,83,0.16) 0%, transparent 50%)",
            },
            children: "",
          },
        },

        // ── Header: lockup + weekly tag + edition line ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "14px" },
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
                    brandHeader(logo, 50, { accent: AMBER }),
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: "15px",
                          letterSpacing: "0.26em",
                          textTransform: "uppercase",
                          color: AMBER,
                        },
                        children: "Weekly Edition",
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
                    fontSize: "16px",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: FG_MUTED,
                  },
                  children: `Edition No. ${edition.editionNumber} · ${edition.weekRange}`,
                },
              },
            ],
          },
        },

        // ── Feature: title + topics ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "40px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize: "90px",
                    lineHeight: 1.08,
                    letterSpacing: "-0.03em",
                    color: FG,
                  },
                  children: "This Week in\nAustralian Property",
                },
              },
              {
                type: "div",
                props: {
                  style: { display: "flex", flexDirection: "column", gap: "28px" },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: "12px",
                          letterSpacing: "0.25em",
                          textTransform: "uppercase",
                          color: AMBER,
                          marginBottom: "2px",
                        },
                        children: "Inside this edition",
                      },
                    },
                    ...topics.map((topic, i) => ({
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
                                color: AMBER,
                                minWidth: "30px",
                                marginTop: "11px",
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
                                fontSize: "40px",
                                lineHeight: 1.26,
                                color: FG,
                              },
                              children: clamp(topic.title, 60),
                            },
                          },
                        ],
                      },
                    })),
                  ],
                },
              },
            ],
          },
        },

        // ── Bottom: byline (headshot) + rule + metrics/domain ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "22px" },
            children: [
              {
                type: "div",
                props: {
                  style: { display: "flex", alignItems: "center", gap: "16px" },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          width: "66px",
                          height: "66px",
                          borderRadius: "33px",
                          border: "2px solid rgba(212,168,83,0.6)",
                          ...(headshot
                            ? {
                                backgroundImage: `url(${headshot})`,
                                backgroundSize: "66px 66px",
                              }
                            : { backgroundColor: "rgba(212,168,83,0.18)" }),
                        },
                        children: "",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: { display: "flex", flexDirection: "column", gap: "3px" },
                        children: [
                          {
                            type: "div",
                            props: {
                              style: {
                                fontFamily: "JetBrains Mono",
                                fontSize: "11px",
                                letterSpacing: "0.22em",
                                textTransform: "uppercase",
                                color: AMBER,
                              },
                              children: "Ruben's Take",
                            },
                          },
                          {
                            type: "div",
                            props: {
                              style: {
                                fontFamily: "Playfair Display",
                                fontWeight: 700,
                                fontSize: "26px",
                                color: FG,
                              },
                              children: "Ruben Laubscher",
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
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
                          color: FG_MUTED,
                        },
                        children: metricsLine,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: "15px",
                          letterSpacing: "0.22em",
                          color: AMBER,
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
 * Weekly edition Story frame: 1080×1920 (9:16), posted to the Story right
 * after the weekly carousel. Lines up with renderWeeklyCoverCard (same edition
 * number lockup, title, and topics contents) but vertical, with a prompt back
 * to the feed for the full edition.
 */
export async function renderWeeklyStoryVertical(
  edition: Edition,
  heroOverride?: string | null
): Promise<Buffer> {
  const logo = await loadLogo("navy");
  // Same edition hero as the cover (with the bundled fallback) so the Story
  // and the cover share one photograph.
  const hero = heroOverride ?? (await loadAsset("hero-weekly.jpg"));
  const headshot = await loadAsset("ruben.jpg");
  const topics = edition.topics.slice(0, 4);
  const metrics = edition.keyMetrics as Record<string, string | undefined> | null | undefined;
  const cashRate = metrics?.cashRate ?? metrics?.cash_rate ?? null;
  const asx = metrics?.asx200 ?? metrics?.ASX200 ?? metrics?.asx ?? null;
  const metricsLine =
    cashRate && asx
      ? `Cash Rate ${cashRate} · ASX 200 ${asx}`
      : cashRate
        ? `Cash Rate ${cashRate}`
        : "Full edition, link in bio";

  const tree = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "1080px",
        height: "1920px",
        backgroundColor: NAVY,
        position: "relative",
        padding: "130px 80px",
        justifyContent: "space-between",
      },
      children: [
        // ── Photographic hero behind everything — the tall sibling of the
        //    weekly cover, so the Story reads as the same premium system. ──
        hero
          ? {
              type: "div",
              props: {
                style: {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "1080px",
                  height: "1920px",
                  display: "flex",
                  backgroundImage: `url(${hero})`,
                  backgroundSize: "1080px 1920px",
                  backgroundPosition: "center",
                },
                children: "",
              },
            }
          : { type: "div", props: { style: { display: "flex" }, children: "" } },
        // Navy veil — light at the top so the photo breathes, heavy at the
        // bottom where the contents and byline sit.
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              width: "1080px",
              height: "1920px",
              display: "flex",
              backgroundImage:
                "linear-gradient(180deg, rgba(12,18,32,0.50) 0%, rgba(12,18,32,0.72) 44%, rgba(12,18,32,0.95) 100%)",
            },
            children: "",
          },
        },
        // Amber bloom, top-right.
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              width: "1080px",
              height: "1920px",
              display: "flex",
              backgroundImage:
                "radial-gradient(circle at 80% 8%, rgba(212,168,83,0.16) 0%, transparent 50%)",
            },
            children: "",
          },
        },

        // ── Header: lockup + weekly tag + edition line ──
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
                    justifyContent: "space-between",
                    alignItems: "center",
                  },
                  children: [
                    brandHeader(logo, 58, { accent: AMBER }),
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: "16px",
                          letterSpacing: "0.26em",
                          textTransform: "uppercase",
                          color: AMBER,
                        },
                        children: "Weekly Edition",
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
                    color: FG_MUTED,
                  },
                  children: `Edition No. ${edition.editionNumber} · ${edition.weekRange}`,
                },
              },
            ],
          },
        },

        // ── Feature: title + topic contents ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "48px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize: "104px",
                    lineHeight: 1.04,
                    letterSpacing: "-0.03em",
                    color: FG,
                  },
                  children: "This Week in\nAustralian Property",
                },
              },
              {
                type: "div",
                props: {
                  style: { display: "flex", flexDirection: "column", gap: "30px" },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: "14px",
                          letterSpacing: "0.25em",
                          textTransform: "uppercase",
                          color: AMBER,
                          marginBottom: "2px",
                        },
                        children: "Inside this edition",
                      },
                    },
                    ...topics.map((topic, i) => ({
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "20px",
                        },
                        children: [
                          {
                            type: "div",
                            props: {
                              style: {
                                fontFamily: "JetBrains Mono",
                                fontSize: "17px",
                                color: AMBER,
                                minWidth: "34px",
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
                                fontSize: "44px",
                                lineHeight: 1.22,
                                color: FG,
                              },
                              children: clamp(topic.title, 62),
                            },
                          },
                        ],
                      },
                    })),
                  ],
                },
              },
            ],
          },
        },

        // ── Bottom: byline (headshot) + rule + metrics/domain ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "26px" },
            children: [
              {
                type: "div",
                props: {
                  style: { display: "flex", alignItems: "center", gap: "18px" },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          width: "74px",
                          height: "74px",
                          borderRadius: "37px",
                          border: "2px solid rgba(212,168,83,0.6)",
                          ...(headshot
                            ? {
                                backgroundImage: `url(${headshot})`,
                                backgroundSize: "74px 74px",
                              }
                            : { backgroundColor: "rgba(212,168,83,0.18)" }),
                        },
                        children: "",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: { display: "flex", flexDirection: "column", gap: "4px" },
                        children: [
                          {
                            type: "div",
                            props: {
                              style: {
                                fontFamily: "JetBrains Mono",
                                fontSize: "12px",
                                letterSpacing: "0.22em",
                                textTransform: "uppercase",
                                color: AMBER,
                              },
                              children: "Ruben's Take",
                            },
                          },
                          {
                            type: "div",
                            props: {
                              style: {
                                fontFamily: "Playfair Display",
                                fontWeight: 700,
                                fontSize: "30px",
                                color: FG,
                              },
                              children: "Ruben Laubscher",
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
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
                          color: FG_MUTED,
                        },
                        children: metricsLine,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: "16px",
                          letterSpacing: "0.22em",
                          color: AMBER,
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
 * Weekly topic card: 1080×1350 portrait.
 * One card per topic — category, title, summary, key takeaway.
 */
export async function renderWeeklyTopicCard(
  topic: EditionTopic,
  slideIndex: number,
  slideTotal: number
): Promise<Buffer> {
  const slideNum = String(slideIndex + 1).padStart(2, "0");
  const totalNum = String(slideTotal).padStart(2, "0");
  const why = topic.whyItMatters ? clamp(topic.whyItMatters, 180) : null;
  // Forward-looking watch items: the analytical payload that turns a bare
  // summary card into a briefing the reader keeps. Up to three, trimmed so
  // each sits on at most two lines.
  const watch = (topic.whatToWatch ?? [])
    .filter((w) => w && w.trim())
    .slice(0, 3)
    .map((w) => clamp(w, 84));
  const takeaway = topic.keyTakeaway ? clamp(topic.keyTakeaway, 175) : null;

  // How much analysis the topic actually ships. With at most one block the
  // card would dead-space, so we switch it to a "standfirst page": the lead
  // grows and the whole block is centred, turning empty space into deliberate
  // editorial breathing room rather than a hole above the folio.
  const analysisBlocks = (why ? 1 : 0) + (watch.length ? 1 : 0) + (takeaway ? 1 : 0);
  const sparse = analysisBlocks <= 1;
  const summary = clamp(topic.summary, sparse ? 320 : 230);
  const summaryFontSize = sparse ? "29px" : "23px";
  const summaryLineHeight = sparse ? 1.58 : 1.62;
  // On a standfirst page the title is the hero, so it scales right up; on a
  // dense card it stays measured to leave room for the analysis blocks.
  const titleFontSize = sparse
    ? topic.title.length > 42
      ? "78px"
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
        backgroundColor: NAVY,
        backgroundImage:
          "radial-gradient(circle at 15% 88%, rgba(212,168,83,0.10) 0%, transparent 50%)",
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
              color: "rgba(212,168,83,0.06)",
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
                    fontSize: "12px",
                    letterSpacing: "0.28em",
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
                    fontSize: "12px",
                    letterSpacing: "0.15em",
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
                          backgroundColor: "rgba(212,168,83,0.14)",
                          border: `1px solid ${AMBER}`,
                          borderRadius: "4px",
                          padding: "6px 16px",
                        },
                        children: {
                          type: "div",
                          props: {
                            style: {
                              fontFamily: "JetBrains Mono",
                              fontSize: "12px",
                              letterSpacing: "0.22em",
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
                        children: clamp(topic.title, 80),
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
                                      fontSize: "11px",
                                      letterSpacing: "0.25em",
                                      textTransform: "uppercase",
                                      color: AMBER,
                                    },
                                    children: "Why It Matters",
                                  },
                                },
                                {
                                  type: "div",
                                  props: {
                                    style: {
                                      fontFamily: "JetBrains Mono",
                                      fontSize: "21px",
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
                        fontSize: "12px",
                        letterSpacing: "0.22em",
                        color: AMBER,
                      },
                      children: "thedesk.au",
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
