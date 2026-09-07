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
const NAVY = "#0C1220";
const INK = "#F0EDE8";
const MUTED = "#929CAD";
const AMBER = "#D4A853";
const RULE = "rgba(240,237,232,0.16)";

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

function headlineSize(length: number): string {
  if (length > 115) return "66px";
  if (length > 90) return "74px";
  if (length > 68) return "84px";
  return "96px";
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
  const title = clamp(input.lead.title, 150);
  const why = clamp(input.lead.whyItMatters, 230);
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
        backgroundColor: NAVY,
        backgroundImage:
          "radial-gradient(circle at 88% 8%, rgba(212,168,83,0.19) 0%, rgba(12,18,32,0) 40%)",
        color: INK,
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
                    color: AMBER,
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
                    color: MUTED,
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
                    color: AMBER,
                  },
                  children: `THE LEAD · ${category}`,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize: headlineSize(title.length),
                    lineHeight: 0.99,
                    letterSpacing: "-0.035em",
                    color: INK,
                    marginTop: "30px",
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
                          fontSize: "30px",
                          lineHeight: 1.42,
                          color: "#C9CED7",
                          marginTop: "28px",
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
                          color: MUTED,
                          textTransform: "uppercase",
                          marginTop: "24px",
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
              borderTop: `1px solid ${RULE}`,
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
                              borderLeft: index > 0 ? `1px solid ${RULE}` : "0",
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
                                    color: AMBER,
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
                                    color: INK,
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
                          borderTop: `1px solid ${RULE}`,
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
                                    color: INK,
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
                                    color: MUTED,
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
                    backgroundImage: `linear-gradient(90deg, ${AMBER}, rgba(212,168,83,0))`,
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
                    color: MUTED,
                  },
                  children: [
                    { type: "span", props: { children: "Australian property intelligence" } },
                    {
                      type: "span",
                      props: { style: { color: AMBER }, children: "thedesk.au" },
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
