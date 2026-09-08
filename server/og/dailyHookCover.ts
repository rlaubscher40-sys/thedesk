/**
 * Hook-first cover for the morning Instagram carousel.
 *
 * The old daily cover led with the product label ("Today's Briefing") and a
 * table of contents. This version makes the lead story itself the grid tile:
 * the scroll-stopping claim is the largest thing on the canvas, while the Desk
 * brand, source proof, supporting stories and live metrics stay subordinate.
 */
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import sharp from "sharp";

const WIDTH = 1080;
const HEIGHT = 1350;
const FONT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fonts");

type CoverVariant = "navy" | "light";
type Palette = {
  bg: string;
  ink: string;
  body: string;
  muted: string;
  amber: string;
  rule: string;
  bloom: string;
  fadeAmber: string;
};

function palette(variant: CoverVariant): Palette {
  if (variant === "light") {
    return {
      bg: "#F4F1EA",
      ink: "#14171F",
      body: "#343946",
      muted: "#5A6072",
      amber: "#9A6B12",
      rule: "rgba(20,23,31,0.16)",
      bloom: "radial-gradient(circle at 88% 8%, rgba(154,107,18,0.12) 0%, rgba(244,241,234,0) 40%)",
      fadeAmber: "rgba(154,107,18,0)",
    };
  }
  return {
    bg: "#0C1220",
    ink: "#F0EDE8",
    body: "#C9CED7",
    muted: "#929CAD",
    amber: "#D4A853",
    rule: "rgba(240,237,232,0.16)",
    bloom: "radial-gradient(circle at 88% 8%, rgba(212,168,83,0.19) 0%, rgba(12,18,32,0) 40%)",
    fadeAmber: "rgba(212,168,83,0)",
  };
}

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

export type DailyHookCoverInput = {
  feedDate?: string | null;
  variant?: CoverVariant;
  lead: {
    title: string;
    category: string;
    source?: string | null;
    whyItMatters?: string | null;
  };
  supporting?: Array<{ title: string; category: string }>;
  metrics?: Array<{ label: string; value: string }>;
};

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function clamp(value: string | null | undefined, max: number): string {
  const text = clean(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.62 ? cut.slice(0, at) : cut).trimEnd()}…`;
}

/**
 * Pull the first source-backed numeric hook out of a headline without doing any
 * maths. The social headline stage already rejects rewritten numbers that are
 * absent from the source title/summary; this only changes typography.
 *
 * Bare four-digit calendar years are deliberately skipped. A grid tile saying
 * "2026" almost never communicates the story, while a percentage, dollar
 * figure, count or ordinary non-year number often does.
 */
export function extractHookStat(title: string): string | null {
  const text = clean(title);
  const pattern = /(?:[$£€]\s*)?\d+(?:,\d{3})*(?:\.\d+)?(?:\s?(?:%|bn|billion|million|m|b|k))?/gi;
  for (const match of text.matchAll(pattern)) {
    const raw = clean(match[0]);
    if (!raw) continue;
    const numeric = Number(
      raw
        .replace(/[$£€,%\s]/g, "")
        .replace(/(?:bn|billion|million|m|b|k)$/i, "")
    );
    const hasQualifier = /[$£€,%]|(?:bn|billion|million|m|b|k)$/i.test(raw);
    if (
      !hasQualifier &&
      Number.isFinite(numeric) &&
      numeric >= 1900 &&
      numeric <= 2100 &&
      /^\d{4}$/.test(raw)
    ) {
      continue;
    }
    return raw.toUpperCase();
  }
  return null;
}

function headlineSize(length: number, hasStat: boolean): string {
  if (hasStat) {
    if (length > 115) return "54px";
    if (length > 90) return "59px";
    if (length > 68) return "64px";
    return "70px";
  }
  if (length > 115) return "66px";
  if (length > 90) return "74px";
  if (length > 68) return "84px";
  return "96px";
}

function statSize(length: number): string {
  if (length >= 12) return "150px";
  if (length >= 9) return "174px";
  if (length >= 6) return "198px";
  return "228px";
}

function formatDate(value?: string | null): string {
  if (!value) return "Today's briefing";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Today's briefing";
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

function buildTree(input: DailyHookCoverInput) {
  const c = palette(input.variant ?? "navy");
  const fullTitle = clamp(input.lead.title, 150);
  const hookStat = extractHookStat(fullTitle);
  const statStartsTitle = hookStat
    ? fullTitle.toUpperCase().startsWith(hookStat.toUpperCase())
    : false;
  const withoutLeadingStat = statStartsTitle && hookStat
    ? fullTitle.slice(hookStat.length).replace(/^[\s:;,.-]+/, "").trim()
    : fullTitle;
  const title = withoutLeadingStat.length >= 14 ? withoutLeadingStat : fullTitle;
  const why = clamp(input.lead.whyItMatters, hookStat ? 190 : 230);
  const supporting = (input.supporting ?? []).slice(0, 2);
  const metrics = (input.metrics ?? []).slice(0, 4);
  const category = clean(input.lead.category).toUpperCase() || "NEWS";
  const source = clamp(input.lead.source, 48);

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        padding: "66px 70px 60px",
        backgroundColor: c.bg,
        backgroundImage: c.bloom,
        color: c.ink,
        justifyContent: "space-between",
      },
      children: [
        {
          type: "div",
          props: {
            style: { display: "flex", alignItems: "center", justifyContent: "space-between" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontFamily: "JetBrains Mono",
                    fontSize: "17px",
                    letterSpacing: "0.27em",
                    textTransform: "uppercase",
                    color: c.amber,
                  },
                  children: "The Desk",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontFamily: "JetBrains Mono",
                    fontSize: "13px",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: c.muted,
                  },
                  children: formatDate(input.feedDate),
                },
              },
            ],
          },
        },

        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", maxWidth: "930px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontFamily: "JetBrains Mono",
                    fontSize: "15px",
                    letterSpacing: "0.24em",
                    textTransform: "uppercase",
                    color: c.amber,
                  },
                  children: `${hookStat ? "THE NUMBER" : "THE LEAD"} · ${category}`,
                },
              },
              ...(hookStat
                ? [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          fontFamily: "Playfair Display",
                          fontWeight: 700,
                          fontSize: statSize(hookStat.length),
                          lineHeight: 0.78,
                          letterSpacing: "-0.055em",
                          color: c.ink,
                          marginTop: "34px",
                        },
                        children: hookStat,
                      },
                    },
                  ]
                : []),
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize: headlineSize(title.length, Boolean(hookStat)),
                    lineHeight: hookStat ? 1.04 : 0.99,
                    letterSpacing: "-0.035em",
                    color: hookStat ? c.body : c.ink,
                    marginTop: hookStat ? "56px" : "30px",
                  },
                  children: title,
                },
              },
              ...(why
                ? [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          fontFamily: "Playfair Display",
                          fontSize: hookStat ? "26px" : "30px",
                          lineHeight: 1.42,
                          color: c.body,
                          marginTop: hookStat ? "22px" : "28px",
                          maxWidth: "900px",
                        },
                        children: why,
                      },
                    },
                  ]
                : []),
              ...(source
                ? [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          fontFamily: "JetBrains Mono",
                          fontSize: "12px",
                          letterSpacing: "0.16em",
                          color: c.muted,
                          textTransform: "uppercase",
                          marginTop: hookStat ? "18px" : "24px",
                        },
                        children: `Source · ${source}`,
                      },
                    },
                  ]
                : []),
            ],
          },
        },

        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              borderTop: `1px solid ${c.rule}`,
              paddingTop: "26px",
              gap: "24px",
            },
            children: [
              ...(supporting.length
                ? [
                    {
                      type: "div",
                      props: {
                        style: { display: "flex", gap: "28px" },
                        children: supporting.map((story, index) => ({
                          type: "div",
                          props: {
                            style: {
                              display: "flex",
                              flexDirection: "column",
                              flex: 1,
                              paddingLeft: index > 0 ? "28px" : "0",
                              borderLeft: index > 0 ? `1px solid ${c.rule}` : "0",
                            },
                            children: [
                              {
                                type: "div",
                                props: {
                                  style: {
                                    display: "flex",
                                    fontFamily: "JetBrains Mono",
                                    fontSize: "11px",
                                    letterSpacing: "0.18em",
                                    textTransform: "uppercase",
                                    color: c.amber,
                                  },
                                  children: `ALSO · ${clean(story.category).toUpperCase()}`,
                                },
                              },
                              {
                                type: "div",
                                props: {
                                  style: {
                                    display: "flex",
                                    fontFamily: "Playfair Display",
                                    fontWeight: 700,
                                    fontSize: "25px",
                                    lineHeight: 1.23,
                                    color: c.ink,
                                    marginTop: "10px",
                                  },
                                  children: clamp(story.title, 86),
                                },
                              },
                            ],
                          },
                        })),
                      },
                    },
                  ]
                : []),
              ...(metrics.length
                ? [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          gap: "34px",
                          borderTop: `1px solid ${c.rule}`,
                          paddingTop: "22px",
                        },
                        children: metrics.map((metric) => ({
                          type: "div",
                          props: {
                            style: { display: "flex", flexDirection: "column", flex: 1 },
                            children: [
                              {
                                type: "div",
                                props: {
                                  style: {
                                    display: "flex",
                                    fontFamily: "Playfair Display",
                                    fontWeight: 700,
                                    fontSize: "31px",
                                    color: c.ink,
                                    lineHeight: 1,
                                  },
                                  children: clamp(metric.value, 18),
                                },
                              },
                              {
                                type: "div",
                                props: {
                                  style: {
                                    display: "flex",
                                    fontFamily: "JetBrains Mono",
                                    fontSize: "10px",
                                    letterSpacing: "0.14em",
                                    textTransform: "uppercase",
                                    color: c.muted,
                                    marginTop: "8px",
                                  },
                                  children: clamp(metric.label, 28),
                                },
                              },
                            ],
                          },
                        })),
                      },
                    },
                  ]
                : []),
            ],
          },
        },

        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "17px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    height: "2px",
                    width: "100%",
                    backgroundImage: `linear-gradient(90deg, ${c.amber}, ${c.fadeAmber})`,
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
                    fontFamily: "JetBrains Mono",
                    fontSize: "12px",
                    letterSpacing: "0.17em",
                    textTransform: "uppercase",
                    color: c.muted,
                  },
                  children: [
                    { type: "span", props: { children: "Australian property intelligence" } },
                    {
                      type: "span",
                      props: { style: { color: c.amber }, children: "thedesk.au" },
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
}

export async function renderDailyHookCoverCard(input: DailyHookCoverInput): Promise<Buffer> {
  const fonts = await loadFonts();
  const svg = await satori(buildTree(input) as never, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: "Playfair Display", data: fonts.playfair, weight: 700, style: "normal" },
      { name: "JetBrains Mono", data: fonts.mono, weight: 400, style: "normal" },
    ],
  });
  const png = Buffer.from(
    new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng()
  );
  return sharp(png).jpeg({ quality: 92 }).toBuffer();
}
