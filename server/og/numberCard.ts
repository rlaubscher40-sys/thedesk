import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import type { DailyMetric } from "../db/schema";

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

function displayValue(metric: DailyMetric): string {
  const value = metric.value.trim();
  const unit = metric.unit?.trim();
  if (!unit) return value;
  if (unit === "%" && value.includes("%")) return value;
  if (unit === "$" && value.startsWith("$")) return value;
  if (["%", "°", "x"].includes(unit)) return `${value}${unit}`;
  if (unit === "$") return `$${value}`;
  return `${value} ${unit}`;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(value);
}

export async function renderNumberCard(metric: DailyMetric): Promise<Buffer> {
  const fonts = await loadFonts();
  const value = displayValue(metric);
  const context = (metric.context ?? "Current reading from The Desk market dashboard").trim();
  const label = metric.label.trim();
  const group = (metric.groupKey ?? "MARKET").toUpperCase();
  const source = metric.source?.trim() || "The Desk data";
  const valueSize = value.length > 12 ? 150 : value.length > 8 ? 184 : 220;
  const contextSize = context.length > 150 ? 34 : context.length > 95 ? 40 : 46;

  const tree = {
    type: "div",
    props: {
      style: {
        width: "1080px",
        height: "1350px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "74px 72px",
        backgroundColor: "#0C1220",
        backgroundImage:
          "radial-gradient(circle at 86% 10%, rgba(212,168,83,0.18) 0%, rgba(12,18,32,0) 45%)",
        color: "#F0EDE8",
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
                    fontFamily: "JetBrains Mono",
                    fontSize: "18px",
                    letterSpacing: "0.24em",
                    textTransform: "uppercase",
                    color: "#D4A853",
                  },
                  children: "The Desk · The Number",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "JetBrains Mono",
                    fontSize: "15px",
                    letterSpacing: "0.2em",
                    color: "#9BA3B5",
                  },
                  children: group,
                },
              },
            ],
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
                    fontSize: "20px",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "#9BA3B5",
                  },
                  children: label,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize: `${valueSize}px`,
                    lineHeight: 0.9,
                    letterSpacing: "-0.045em",
                    color: "#F0EDE8",
                  },
                  children: value,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    width: "170px",
                    height: "4px",
                    backgroundColor: "#D4A853",
                    marginTop: "10px",
                  },
                  children: "",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    maxWidth: "880px",
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize: `${contextSize}px`,
                    lineHeight: 1.18,
                    letterSpacing: "-0.018em",
                    color: "#F0EDE8",
                  },
                  children: context.length > 205 ? `${context.slice(0, 202).trimEnd()}…` : context,
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
              {
                type: "div",
                props: {
                  style: {
                    width: "100%",
                    height: "1px",
                    backgroundImage:
                      "linear-gradient(90deg, #D4A853 0%, rgba(212,168,83,0) 72%)",
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
                          fontFamily: "JetBrains Mono",
                          fontSize: "14px",
                          letterSpacing: "0.12em",
                          color: "#9BA3B5",
                        },
                        children: `${source} · ${formatDate(metric.asOf)}`,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: "16px",
                          letterSpacing: "0.2em",
                          color: "#D4A853",
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

  const svg = await satori(tree as never, {
    width: 1080,
    height: 1350,
    fonts: [
      { name: "Playfair Display", data: fonts.playfair, weight: 700, style: "normal" },
      { name: "JetBrains Mono", data: fonts.mono, weight: 400, style: "normal" },
    ],
  });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1080 } });
  return Buffer.from(resvg.render().asPng());
}
