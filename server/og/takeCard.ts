/**
 * Native 4:5 social asset for the editorial "The Desk Take" franchise.
 *
 * This is deliberately text-first: one sharp interpretation, the story it is
 * reacting to, and a small evidence footer. It is not a screenshot and it is
 * never rendered from arbitrary browser copy; callers pass a trusted story.
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

export type DeskTakeCardInput = {
  format?: "take" | "market";
  take: string;
  storyTitle: string;
  category: string;
  source: string | null;
  context: string | null;
  feedDate: string;
};

export function clampTakeText(value: string, max = 520): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.62 ? cut.slice(0, at) : cut).trim()}…`;
}

function takeSize(length: number): string {
  if (length > 390) return "45px";
  if (length > 290) return "51px";
  if (length > 190) return "58px";
  return "68px";
}

function buildTree(input: DeskTakeCardInput) {
  const take = clampTakeText(input.take);
  const story = clampTakeText(input.storyTitle, 150);
  const context = input.context ? clampTakeText(input.context, 250) : null;

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        padding: "74px 76px 66px",
        backgroundColor: NAVY,
        backgroundImage:
          "radial-gradient(circle at 88% 10%, rgba(212,168,83,0.19) 0%, rgba(12,18,32,0) 39%)",
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
                    letterSpacing: "0.23em",
                    textTransform: "uppercase",
                    color: MUTED,
                  },
                  children: input.format === "market" ? "The Market File" : "The Desk Take",
                },
              },
            ],
          },
        },
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "26px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontFamily: "JetBrains Mono",
                    fontSize: "14px",
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: AMBER,
                  },
                  children:
                    input.format === "market"
                      ? `${input.category} · In the reporting`
                      : `${input.category} · Our read`,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize: takeSize(take.length),
                    lineHeight: 1.08,
                    letterSpacing: "-0.035em",
                    maxWidth: "910px",
                  },
                  children: take,
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
              flexDirection: "column",
              gap: "20px",
              borderTop: `1px solid ${RULE}`,
              borderBottom: `1px solid ${RULE}`,
              padding: "30px 0",
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
                  children: input.format === "market" ? "Open the file" : "Reacting to",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize: "34px",
                    lineHeight: 1.2,
                    letterSpacing: "-0.02em",
                    maxWidth: "900px",
                  },
                  children: story,
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
                          fontSize: "23px",
                          lineHeight: 1.46,
                          color: "#C9CED7",
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
            style: { display: "flex", flexDirection: "column", gap: "18px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    width: "100%",
                    height: "2px",
                    background: `linear-gradient(90deg, ${AMBER} 0%, rgba(212,168,83,0) 75%)`,
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
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: MUTED,
                  },
                  children: [
                    {
                      type: "span",
                      props: {
                        children: [input.feedDate, input.source].filter(Boolean).join(" · "),
                      },
                    },
                    { type: "span", props: { children: "thedesk.au" } },
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

export async function renderDeskTakeCard(input: DeskTakeCardInput): Promise<Buffer> {
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
