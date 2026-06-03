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

const FONT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fonts"
);

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
    mono: mono.buffer.slice(
      mono.byteOffset,
      mono.byteOffset + mono.byteLength
    ) as ArrayBuffer,
  };
  return cachedFonts;
}

/**
 * The Desk lockup (logo + wordmark), light colourway on transparent, copied
 * into the fonts dir so the build bundles it next to dist/. Loaded once as a
 * base64 data URI that satori can embed as an <img>. Putting the actual brand
 * mark on every card builds recognition far better than a text wordmark.
 */
let cachedLogo: string | null = null;
async function loadLogo(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const buf = await fs.promises.readFile(path.join(FONT_DIR, "desk-lockup.png"));
    cachedLogo = `data:image/png;base64,${buf.toString("base64")}`;
    return cachedLogo;
  } catch (err) {
    // If the bundled logo can't be read (e.g. not copied into the build),
    // fall back to the text wordmark rather than failing the whole post.
    console.warn("[instagramCards] logo unavailable, using text wordmark:", (err as Error).message);
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
};

function colorScheme(variant: CardVariant): Scheme {
  if (variant === "light") {
    return {
      bg: "#F4F1EA", // warm paper, not stark white
      fg: "#14171F", // near-ink
      fgMuted: "#5A6072",
      amber: "#9A6B12", // deepened so it clears contrast on the pale bg
      amberSoft: "rgba(154,107,18,0.12)",
      bloom:
        "radial-gradient(circle at 85% 12%, rgba(154,107,18,0.10) 0%, transparent 52%)",
      rule: "linear-gradient(90deg, #9A6B12 0%, rgba(154,107,18,0) 70%)",
    };
  }
  return {
    bg: NAVY,
    fg: FG,
    fgMuted: FG_MUTED,
    amber: AMBER,
    amberSoft: "rgba(212,168,83,0.14)",
    bloom:
      "radial-gradient(circle at 85% 12%, rgba(212,168,83,0.13) 0%, transparent 52%)",
    rule: "linear-gradient(90deg, #D4A853 0%, rgba(212,168,83,0) 70%)",
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
function fitFontSize(
  len: number,
  tiers: Array<[number, string]>,
  fallback: string
): string {
  for (const [max, size] of tiers) {
    if (len <= max) return size;
  }
  return fallback;
}

async function renderToJpeg(
  tree: object,
  width: number,
  height: number
): Promise<Buffer> {
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
  return sharp(png).jpeg({ quality: 92 }).toBuffer();
}

/**
 * Daily story card: 1080×1080 square.
 * Displays one story per slide with category, headline, and why-it-matters.
 */
export async function renderDailyStoryCard(
  story: DailyFeedItem,
  slideIndex: number,
  slideTotal: number
): Promise<Buffer> {
  const logo = await loadLogo();
  const slideNum = String(slideIndex + 1).padStart(2, "0");
  const totalNum = String(slideTotal).padStart(2, "0");
  const headline = clamp(story.title, 90);
  // Show the full sentence — never cut "why it matters" mid-word. Upstream
  // generation caps this at 320 chars; the clamp here is only a last-resort
  // guard against pathological lengths. Font scales down so it always fits.
  const why = story.whyItMatters ? clamp(story.whyItMatters, 320) : null;
  const whyFontSize = why
    ? fitFontSize(why.length, [[150, "30px"], [220, "26px"]], "23px")
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
        backgroundColor: NAVY,
        backgroundImage:
          "radial-gradient(circle at 85% 12%, rgba(212,168,83,0.13) 0%, transparent 52%)",
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
              brandHeader(logo, 56),
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "JetBrains Mono",
                    fontSize: "15px",
                    letterSpacing: "0.15em",
                    color: FG_MUTED,
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
                    backgroundColor: "rgba(212,168,83,0.14)",
                    border: `1px solid ${AMBER}`,
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
                        color: AMBER,
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
                    color: FG,
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
                          borderLeft: `3px solid ${AMBER}`,
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
                                fontSize: whyFontSize,
                                lineHeight: 1.45,
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
                          textTransform: "uppercase",
                          color: FG_MUTED,
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
  variant: CardVariant = "navy"
): Promise<Buffer> {
  const logo = await loadLogo();
  const c = colorScheme(variant);
  const dateLabel = formatBriefingDate(feedDate);
  const items = stories.slice(0, 3);

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
              brandHeader(logo, 56, {
                accent: c.amber,
                forceText: variant === "light",
              }),
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

        // ── Middle: date + title + contents ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "24px" },
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
                    fontSize: "82px",
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
                    gap: "18px",
                    marginTop: "8px",
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
                              marginTop: "10px",
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
                              fontSize: "34px",
                              lineHeight: 1.15,
                              color: c.fg,
                            },
                            children: clamp(s.title, 70),
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
 * after the feed carousel. Features the lead story headline and a prompt back
 * to the feed for the full briefing. Same brand tokens as the square cards.
 */
export async function renderDailyStoryVertical(
  story: DailyFeedItem
): Promise<Buffer> {
  const logo = await loadLogo();
  const headline = clamp(story.title, 100);
  // Show the full sentence — never cut "why it matters" mid-word. The 320-char
  // clamp is only a last-resort guard; font scales down so it always fits.
  const why = story.whyItMatters ? clamp(story.whyItMatters, 320) : null;
  const whyFontSize = why
    ? fitFontSize(why.length, [[200, "34px"], [280, "30px"]], "27px")
    : "34px";
  const category = (story.category || "NEWS").toUpperCase();
  const fontSize = headline.length > 72 ? "76px" : "92px";

  const tree = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "1080px",
        height: "1920px",
        backgroundColor: NAVY,
        backgroundImage:
          "radial-gradient(circle at 82% 10%, rgba(212,168,83,0.14) 0%, transparent 50%)",
        padding: "120px 80px",
        justifyContent: "space-between",
      },
      children: [
        // ── Top: branding ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "20px" },
            children: [
              brandHeader(logo, 76),
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
                  children: "Today's briefing is live",
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
                        fontSize: "18px",
                        letterSpacing: "0.22em",
                        color: AMBER,
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
                    color: FG,
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
                          borderLeft: `3px solid ${AMBER}`,
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
                                fontSize: whyFontSize,
                                lineHeight: 1.45,
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
                    color: FG,
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
                          textTransform: "uppercase",
                          color: FG_MUTED,
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
 * Weekly edition cover card: 1080×1350 portrait.
 * Shows edition number, week range, and topic list as a contents page.
 */
export async function renderWeeklyCoverCard(edition: Edition): Promise<Buffer> {
  const topics = edition.topics.slice(0, 4);
  const metrics = edition.keyMetrics as
    | Record<string, string | undefined>
    | null
    | undefined;
  const cashRate =
    metrics?.cashRate ?? metrics?.cash_rate ?? null;
  const asx =
    metrics?.asx200 ?? metrics?.ASX200 ?? metrics?.asx ?? null;
  const metricsLine =
    cashRate && asx
      ? `Cash Rate ${cashRate} · ASX 200 ${asx}`
      : cashRate
        ? `Cash Rate ${cashRate}`
        : "Swipe for this week’s analysis »";

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
          "radial-gradient(circle at 80% 8%, rgba(212,168,83,0.14) 0%, transparent 50%)",
        padding: "80px 72px",
        justifyContent: "space-between",
      },
      children: [
        // ── Header ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "8px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "JetBrains Mono",
                    fontSize: "12px",
                    letterSpacing: "0.3em",
                    textTransform: "uppercase",
                    color: AMBER,
                  },
                  children: "The Desk · Weekly Edition",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "JetBrains Mono",
                    fontSize: "12px",
                    letterSpacing: "0.18em",
                    color: FG_MUTED,
                  },
                  children: `Edition No. ${edition.editionNumber} · ${edition.weekRange}`,
                },
              },
            ],
          },
        },

        // ── Large edition number + title ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize: "160px",
                    lineHeight: 0.85,
                    letterSpacing: "-0.04em",
                    color: "rgba(212,168,83,0.18)",
                  },
                  children: `#${edition.editionNumber}`,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize: "58px",
                    lineHeight: 1.05,
                    letterSpacing: "-0.025em",
                    color: FG,
                    marginTop: "20px",
                  },
                  children: "This Week in\nAustralian Finance",
                },
              },
            ],
          },
        },

        // ── Topics list ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "20px" },
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
                    marginBottom: "4px",
                  },
                  children: "This Week’s Topics",
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
                          fontSize: "12px",
                          color: AMBER,
                          minWidth: "24px",
                          marginTop: "4px",
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
                          fontSize: "26px",
                          lineHeight: 1.2,
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

        // ── Bottom: metrics + domain ──
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
  edition: Edition
): Promise<Buffer> {
  const topics = edition.topics.slice(0, 4);

  const tree = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "1080px",
        height: "1920px",
        backgroundColor: NAVY,
        backgroundImage:
          "radial-gradient(circle at 80% 8%, rgba(212,168,83,0.14) 0%, transparent 50%)",
        padding: "120px 80px",
        justifyContent: "space-between",
      },
      children: [
        // ── Header ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "10px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "JetBrains Mono",
                    fontSize: "13px",
                    letterSpacing: "0.3em",
                    textTransform: "uppercase",
                    color: AMBER,
                  },
                  children: "The Desk · Weekly Edition",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "JetBrains Mono",
                    fontSize: "13px",
                    letterSpacing: "0.18em",
                    color: FG_MUTED,
                  },
                  children: `Edition No. ${edition.editionNumber} · ${edition.weekRange}`,
                },
              },
            ],
          },
        },

        // ── Large edition number + title ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize: "200px",
                    lineHeight: 0.85,
                    letterSpacing: "-0.04em",
                    color: "rgba(212,168,83,0.18)",
                  },
                  children: `#${edition.editionNumber}`,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize: "66px",
                    lineHeight: 1.05,
                    letterSpacing: "-0.025em",
                    color: FG,
                    marginTop: "24px",
                  },
                  children: "This Week in\nAustralian Finance",
                },
              },
            ],
          },
        },

        // ── Topics contents ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "22px" },
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
                    marginBottom: "4px",
                  },
                  children: "This Week’s Topics",
                },
              },
              ...topics.map((topic, i) => ({
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "18px",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: "13px",
                          color: AMBER,
                          minWidth: "26px",
                          marginTop: "6px",
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
                          fontSize: "30px",
                          lineHeight: 1.2,
                          color: FG,
                        },
                        children: clamp(topic.title, 64),
                      },
                    },
                  ],
                },
              })),
            ],
          },
        },

        // ── Bottom: feed prompt + rule + domain ──
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
                    color: FG,
                  },
                  children: "The full edition is live on our feed",
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
                  style: { display: "flex", justifyContent: "flex-end" },
                  children: {
                    type: "div",
                    props: {
                      style: {
                        fontFamily: "JetBrains Mono",
                        fontSize: "13px",
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
  const summary = clamp(topic.summary, 220);
  const takeaway = topic.keyTakeaway ? clamp(topic.keyTakeaway, 170) : null;
  const titleFontSize = topic.title.length > 55 ? "50px" : "60px";

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
        justifyContent: "space-between",
      },
      children: [
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

        // ── Middle: topic content ──
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: "32px",
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
                    padding: "5px 14px",
                  },
                  children: {
                    type: "div",
                    props: {
                      style: {
                        fontFamily: "JetBrains Mono",
                        fontSize: "11px",
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
                    lineHeight: 1.05,
                    letterSpacing: "-0.025em",
                    color: FG,
                  },
                  children: clamp(topic.title, 80),
                },
              },
              // Summary
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "JetBrains Mono",
                    fontSize: "19px",
                    lineHeight: 1.65,
                    color: FG_MUTED,
                  },
                  children: summary,
                },
              },
              // Key takeaway box
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
                          padding: "24px",
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
                                fontSize: "18px",
                                lineHeight: 1.55,
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
