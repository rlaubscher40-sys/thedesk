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

const NAVY = "#0C1220";
const AMBER = "#D4A853";
const FG = "#F0EDE8";
const FG_MUTED = "#9BA3B5";

function clamp(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
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
  const slideNum = String(slideIndex + 1).padStart(2, "0");
  const totalNum = String(slideTotal).padStart(2, "0");
  const headline = clamp(story.title, 100);
  const why = story.whyItMatters ? clamp(story.whyItMatters, 200) : null;
  const category = (story.category || "NEWS").toUpperCase();
  const fontSize = headline.length > 70 ? "46px" : "56px";

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
                  children: "The Desk · Daily Intelligence",
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
                        fontSize: "11px",
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
                                fontSize: "10px",
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
                                fontSize: "17px",
                                lineHeight: 1.6,
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
                          fontSize: "12px",
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
                          fontSize: "12px",
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
 * Daily Story frame: 1080×1920 (9:16), for the Instagram Story posted right
 * after the feed carousel. Features the lead story headline and a prompt back
 * to the feed for the full briefing. Same brand tokens as the square cards.
 */
export async function renderDailyStoryVertical(
  story: DailyFeedItem
): Promise<Buffer> {
  const headline = clamp(story.title, 110);
  const why = story.whyItMatters ? clamp(story.whyItMatters, 240) : null;
  const category = (story.category || "NEWS").toUpperCase();
  const fontSize = headline.length > 80 ? "58px" : "70px";

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
                  children: "The Desk · Daily Intelligence",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "JetBrains Mono",
                    fontSize: "13px",
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
                        fontSize: "13px",
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
                                fontSize: "12px",
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
                                lineHeight: 1.6,
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
        : "Swipe for this week’s analysis →";

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
                          fontSize: "12px",
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
