/**
 * Native distribution card for The Desk's live signal format.
 *
 * One number owns the canvas. Context and The Desk Take sit underneath so the
 * asset reads as an editorial claim, not a dashboard screenshot.
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

export type SignalCardInput = {
  label: string;
  value: string;
  context: string | null;
  move: string | null;
  deskTake: string | null;
  source: string | null;
  asOf: string | null;
};

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function clamp(value: string | null | undefined, max: number): string {
  const text = clean(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).trim()}…`;
}

function valueSize(value: string): string {
  if (value.length > 16) return "128px";
  if (value.length > 11) return "154px";
  if (value.length > 7) return "184px";
  return "224px";
}

function buildTree(input: SignalCardInput) {
  const label = clamp(input.label, 70);
  const value = clamp(input.value, 24);
  const context = clamp(input.context, 220);
  const deskTake = clamp(input.deskTake, 280);
  const sourceLine = [clean(input.source), clean(input.asOf)].filter(Boolean).join(" · ");

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        padding: "72px 76px 66px",
        backgroundColor: NAVY,
        backgroundImage:
          "radial-gradient(circle at 88% 8%, rgba(212,168,83,0.20) 0%, rgba(12,18,32,0) 40%)",
        color: INK,
        justifyContent: "space-between",
      },
      children: [
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
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: MUTED,
                  },
                  children: "Live Signal",
                },
              },
            ],
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
                    display: "flex",
                    fontFamily: "JetBrains Mono",
                    fontSize: "15px",
                    letterSpacing: "0.25em",
                    textTransform: "uppercase",
                    color: AMBER,
                  },
                  children: "The Number",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize: valueSize(value),
                    lineHeight: 0.82,
                    letterSpacing: "-0.06em",
                    color: INK,
                    marginTop: "32px",
                  },
                  children: value,
                },
              },
              ...(input.move
                ? [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          fontFamily: "JetBrains Mono",
                          fontSize: "14px",
                          color: AMBER,
                          letterSpacing: "0.13em",
                          marginTop: "28px",
                        },
                        children: clamp(input.move, 70),
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
                    fontSize: "54px",
                    lineHeight: 1.05,
                    letterSpacing: "-0.025em",
                    color: INK,
                    marginTop: "32px",
                    maxWidth: "900px",
                  },
                  children: label,
                },
              },
              ...(context
                ? [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          fontFamily: "Playfair Display",
                          fontSize: "30px",
                          lineHeight: 1.45,
                          color: "#C9CED7",
                          marginTop: "24px",
                          maxWidth: "900px",
                        },
                        children: context,
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
              borderBottom: `1px solid ${RULE}`,
              padding: "28px 0",
              gap: "12px",
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
                    fontSize: "28px",
                    lineHeight: 1.4,
                    color: deskTake ? INK : MUTED,
                  },
                  children: deskTake || "Watch the direction of travel, not one isolated print.",
                },
              },
            ],
          },
        },

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
                    height: "2px",
                    backgroundImage: `linear-gradient(90deg, ${AMBER}, rgba(212,168,83,0))`,
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
                          fontFamily: "JetBrains Mono",
                          fontSize: "12px",
                          letterSpacing: "0.14em",
                          color: MUTED,
                          textTransform: "uppercase",
                        },
                        children: sourceLine || "The Desk live metrics",
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
                        children: "thedesk.au/signals",
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
}

export async function renderSignalCard(input: SignalCardInput): Promise<Buffer> {
  const fonts = await loadFonts();
  const svg = await satori(buildTree(input) as never, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: "Playfair Display", data: fonts.playfair, weight: 700, style: "normal" },
      { name: "JetBrains Mono", data: fonts.mono, weight: 400, style: "normal" },
    ],
  });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng());
}
