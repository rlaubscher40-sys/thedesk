/**
 * Native 4:5 distribution asset for The Desk's "The Chart" franchise.
 *
 * Unlike The Number, this card makes the direction of travel the hero. It is
 * rendered only from stored metric history, so the visual cannot be supplied
 * or manipulated by a client.
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

export type TrendCardInput = {
  label: string;
  value: string;
  unit: string | null;
  context: string | null;
  source: string | null;
  asOf: string | null;
  series: Array<{ value: number; recordedAt: Date }>;
};

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function clamp(value: string | null | undefined, max: number): string {
  const text = clean(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.62 ? cut.slice(0, at) : cut).trim()}…`;
}

export function buildTrendPath(
  values: number[],
  width = 900,
  height = 360,
  padding = 18
): { d: string; min: number; max: number } {
  if (values.length === 0) return { d: "", min: 0, max: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, Math.abs(max) * 0.01, 1e-9);
  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);
  const points = values.map((value, index) => {
    const x = padding + (values.length === 1 ? usableWidth / 2 : (index / (values.length - 1)) * usableWidth);
    const y = padding + (1 - (value - min) / span) * usableHeight;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  });
  return { d: points.join(" "), min, max };
}

function pctMove(first: number, last: number): number | null {
  if (!Number.isFinite(first) || !Number.isFinite(last) || Math.abs(first) < 1e-9) return null;
  return ((last - first) / Math.abs(first)) * 100;
}

function changeLine(series: TrendCardInput["series"]): string {
  if (series.length < 2) return "Not enough recorded history for a 30-day change";
  const first = series[0]!.value;
  const last = series[series.length - 1]!.value;
  const pct = pctMove(first, last);
  if (pct == null) return `${last >= first ? "+" : ""}${(last - first).toFixed(2)} across recorded history`;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(Math.abs(pct) >= 10 ? 1 : 2)}% across recorded history`;
}

function dateLabel(value: Date | undefined): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "Australia/Sydney",
  }).format(value);
}

function buildTree(input: TrendCardInput) {
  const values = input.series.map((point) => point.value);
  const chart = buildTrendPath(values);
  const start = dateLabel(input.series[0]?.recordedAt);
  const end = dateLabel(input.series[input.series.length - 1]?.recordedAt);
  const sourceLine = [clean(input.source), clean(input.asOf)].filter(Boolean).join(" · ");
  const current = clamp(`${input.value}${input.unit ?? ""}`, 28);

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        padding: "72px 76px 64px",
        backgroundColor: NAVY,
        backgroundImage:
          "radial-gradient(circle at 90% 7%, rgba(212,168,83,0.18) 0%, rgba(12,18,32,0) 38%)",
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
                  children: "The Chart",
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
                    fontSize: "14px",
                    letterSpacing: "0.23em",
                    textTransform: "uppercase",
                    color: AMBER,
                  },
                  children: "30-day direction of travel",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize: "64px",
                    lineHeight: 1.02,
                    letterSpacing: "-0.035em",
                    marginTop: "24px",
                    maxWidth: "900px",
                  },
                  children: clamp(input.label, 95),
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "baseline",
                    gap: "24px",
                    marginTop: "28px",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          fontFamily: "Playfair Display",
                          fontWeight: 700,
                          fontSize: current.length > 13 ? "104px" : "132px",
                          lineHeight: 0.86,
                          letterSpacing: "-0.055em",
                        },
                        children: current,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          fontFamily: "JetBrains Mono",
                          fontSize: "14px",
                          letterSpacing: "0.08em",
                          color: AMBER,
                        },
                        children: changeLine(input.series),
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
              flexDirection: "column",
              borderTop: `1px solid ${RULE}`,
              borderBottom: `1px solid ${RULE}`,
              padding: "28px 0 24px",
            },
            children: [
              {
                type: "svg",
                props: {
                  width: 928,
                  height: 360,
                  viewBox: "0 0 900 360",
                  children: [
                    {
                      type: "line",
                      props: {
                        x1: 18,
                        y1: 342,
                        x2: 882,
                        y2: 342,
                        stroke: "rgba(240,237,232,0.14)",
                        strokeWidth: 1,
                      },
                    },
                    {
                      type: "path",
                      props: {
                        d: chart.d,
                        fill: "none",
                        stroke: AMBER,
                        strokeWidth: 5,
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
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
                    justifyContent: "space-between",
                    fontFamily: "JetBrains Mono",
                    fontSize: "12px",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: MUTED,
                    marginTop: "8px",
                  },
                  children: [
                    { type: "span", props: { children: start || "Start" } },
                    { type: "span", props: { children: `${input.series.length} recorded points` } },
                    { type: "span", props: { children: end || "Now" } },
                  ],
                },
              },
            ],
          },
        },
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "20px" },
            children: [
              ...(clean(input.context)
                ? [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          fontFamily: "Playfair Display",
                          fontSize: "29px",
                          lineHeight: 1.42,
                          color: "#C9CED7",
                          maxWidth: "900px",
                        },
                        children: clamp(input.context, 230),
                      },
                    },
                  ]
                : []),
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily: "JetBrains Mono",
                    fontSize: "12px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: MUTED,
                  },
                  children: [
                    { type: "span", props: { children: sourceLine || "The Desk live metrics" } },
                    { type: "span", props: { children: "thedesk.au/trends" } },
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

export async function renderTrendCard(input: TrendCardInput): Promise<Buffer> {
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
