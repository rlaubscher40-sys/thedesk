/**
 * Share card for Ask The Desk intelligence answers.
 *
 * 1080×1350 (4:5) is the native Instagram feed aspect ratio and also shares
 * cleanly to LinkedIn, Messages and Slack. The treatment is deliberately more
 * cinematic than the website: one large thesis, one supporting read, and a
 * source/confidence footer. It is a distribution object, not a screenshot of
 * the UI.
 */
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";

const WIDTH = 1080;
const HEIGHT = 1350;
const FONT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fonts");

const NAVY = "#0C1220";
const NAVY_RAISED = "#131C2D";
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

export type IntelligenceCardInput = {
  question: string;
  headline: string;
  answer: string;
  deskTake: string;
  confidence: "high" | "medium" | "low";
  sourceCount: number;
  signal?: { label: string; value: string; context: string } | null;
};

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function clampWords(text: string, max: number): string {
  const value = clean(text);
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.65 ? cut.slice(0, at) : cut).trimEnd()}…`;
}

function mark(size: number, color: string) {
  const width = Math.round((size * 240) / 280);
  return {
    type: "svg",
    props: {
      width,
      height: size,
      viewBox: "0 0 240 280",
      xmlns: "http://www.w3.org/2000/svg",
      children: [
        {
          type: "g",
          props: {
            fill: "none",
            stroke: color,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            children: [
              {
                type: "g",
                props: {
                  strokeWidth: 5,
                  children: [
                    { type: "line", props: { x1: 56, y1: 16, x2: 56, y2: 264 } },
                    { type: "line", props: { x1: 56, y1: 100, x2: 92, y2: 100 } },
                    { type: "line", props: { x1: 56, y1: 264, x2: 92, y2: 264 } },
                    { type: "path", props: { d: "M 92 100 A 82 82 0 0 1 92 264" } },
                  ],
                },
              },
              {
                type: "path",
                props: {
                  d: "M 68.3 177 A 36 36 0 0 1 140.3 177 Z",
                  fill: color,
                  stroke: "none",
                },
              },
            ],
          },
        },
      ],
    },
  };
}

function headlineSize(length: number): string {
  if (length > 145) return "62px";
  if (length > 105) return "70px";
  if (length > 72) return "80px";
  return "92px";
}

function buildTree(input: IntelligenceCardInput) {
  const headline = clampWords(input.headline, 180);
  const answer = clampWords(input.answer, 330);
  const take = clampWords(input.deskTake, 260);
  const question = clampWords(input.question, 115);
  const signal = input.signal
    ? {
        label: clampWords(input.signal.label, 36),
        value: clampWords(input.signal.value, 30),
        context: clampWords(input.signal.context, 95),
      }
    : null;

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        padding: "76px 76px 68px",
        backgroundColor: NAVY,
        backgroundImage:
          "radial-gradient(circle at 88% 7%, rgba(212,168,83,0.18) 0%, rgba(12,18,32,0) 38%), radial-gradient(circle at 8% 94%, rgba(72,105,160,0.12) 0%, rgba(12,18,32,0) 38%)",
        color: INK,
        justifyContent: "space-between",
        fontFamily: "Playfair Display",
        position: "relative",
      },
      children: [
        // Header / lockup.
        {
          type: "div",
          props: {
            style: { display: "flex", alignItems: "center", justifyContent: "space-between" },
            children: [
              {
                type: "div",
                props: {
                  style: { display: "flex", alignItems: "center", gap: "14px" },
                  children: [
                    mark(48, AMBER),
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          fontFamily: "JetBrains Mono",
                          fontSize: "16px",
                          letterSpacing: "0.25em",
                          textTransform: "uppercase",
                          color: AMBER,
                        },
                        children: "The Desk",
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
                    fontFamily: "JetBrains Mono",
                    fontSize: "13px",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: MUTED,
                  },
                  children: "Intelligence Brief",
                },
              },
            ],
          },
        },

        // Main thesis.
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "28px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontFamily: "JetBrains Mono",
                    fontSize: "14px",
                    lineHeight: 1.45,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: AMBER,
                    maxWidth: "860px",
                  },
                  children: `ASKED · ${question}`,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize: headlineSize(headline.length),
                    lineHeight: 0.98,
                    letterSpacing: "-0.035em",
                    color: INK,
                    maxWidth: "930px",
                  },
                  children: headline,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontFamily: "Playfair Display",
                    fontSize: "27px",
                    lineHeight: 1.47,
                    color: "#C9CED7",
                    maxWidth: "900px",
                  },
                  children: answer,
                },
              },
            ],
          },
        },

        // Signal / Desk Take plate.
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: signal ? "row" : "column",
              gap: signal ? "34px" : "14px",
              borderTop: `1px solid ${RULE}`,
              borderBottom: `1px solid ${RULE}`,
              padding: "30px 0",
              alignItems: signal ? "stretch" : "flex-start",
            },
            children: [
              ...(signal
                ? [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          flexDirection: "column",
                          width: "260px",
                          paddingRight: "32px",
                          borderRight: `1px solid ${RULE}`,
                          justifyContent: "center",
                        },
                        children: [
                          {
                            type: "div",
                            props: {
                              style: {
                                display: "flex",
                                fontFamily: "JetBrains Mono",
                                fontSize: "12px",
                                letterSpacing: "0.2em",
                                textTransform: "uppercase",
                                color: MUTED,
                              },
                              children: signal.label,
                            },
                          },
                          {
                            type: "div",
                            props: {
                              style: {
                                display: "flex",
                                fontFamily: "Playfair Display",
                                fontWeight: 700,
                                fontSize: "52px",
                                lineHeight: 1,
                                color: AMBER,
                                marginTop: "10px",
                              },
                              children: signal.value,
                            },
                          },
                          {
                            type: "div",
                            props: {
                              style: {
                                display: "flex",
                                fontFamily: "JetBrains Mono",
                                fontSize: "11px",
                                lineHeight: 1.45,
                                color: MUTED,
                                marginTop: "10px",
                              },
                              children: signal.context,
                            },
                          },
                        ],
                      },
                    },
                  ]
                : []),
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    justifyContent: "center",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          fontFamily: "JetBrains Mono",
                          fontSize: "12px",
                          letterSpacing: "0.22em",
                          textTransform: "uppercase",
                          color: AMBER,
                        },
                        children: "The Desk Take",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          fontFamily: "Playfair Display",
                          fontSize: signal ? "24px" : "28px",
                          lineHeight: 1.42,
                          color: INK,
                          marginTop: "10px",
                        },
                        children: take,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },

        // Footer proof strip.
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    width: "100%",
                    height: "2px",
                    background: `linear-gradient(90deg, ${AMBER} 0%, rgba(212,168,83,0) 72%)`,
                  },
                  children: "",
                },
              },
              {
                type: "div",
                props: {
                  style: { display: "flex", justifyContent: "space-between", alignItems: "center" },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          gap: "26px",
                          fontFamily: "JetBrains Mono",
                          fontSize: "12px",
                          letterSpacing: "0.15em",
                          textTransform: "uppercase",
                          color: MUTED,
                        },
                        children: [
                          { type: "span", props: { children: `${input.sourceCount} source${input.sourceCount === 1 ? "" : "s"}` } },
                          { type: "span", props: { children: `Confidence · ${input.confidence}` } },
                        ],
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          fontFamily: "JetBrains Mono",
                          fontSize: "13px",
                          letterSpacing: "0.2em",
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

        // Subtle lower-right plate gives depth without turning the card into
        // a generic rounded SaaS tile.
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              position: "absolute",
              right: "-150px",
              bottom: "170px",
              width: "430px",
              height: "430px",
              border: `1px solid ${RULE}`,
              transform: "rotate(18deg)",
              backgroundColor: NAVY_RAISED,
              opacity: 0.16,
            },
            children: "",
          },
        },
      ],
    },
  };
}

export async function renderIntelligenceCard(input: IntelligenceCardInput): Promise<Buffer> {
  const fonts = await loadFonts();
  const tree = buildTree(input);
  const svg = await satori(tree as never, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: "Playfair Display", data: fonts.playfair, weight: 700, style: "normal" },
      { name: "JetBrains Mono", data: fonts.mono, weight: 400, style: "normal" },
    ],
  });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } });
  return Buffer.from(resvg.render().asPng());
}
