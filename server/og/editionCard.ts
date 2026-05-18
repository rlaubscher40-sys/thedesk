/**
 * Edition OG card generator.
 *
 * Renders a branded 1200×630 PNG for sharing edition links on
 * LinkedIn / X / Slack. The card carries the canonical lockup, the
 * edition's title, week-of, and Ruben's byline, same surface as the
 * masthead so the link preview reads as continuous with the site.
 *
 * Pipeline: satori turns a JSX-like tree into SVG with embedded text
 * (using the bundled Playfair / JetBrains Mono TTFs), then resvg-js
 * rasterises the SVG to PNG. Both fonts are committed under
 * server/og/fonts/ and copied next to the build output by the build
 * script, runtime path is fonts/* relative to import.meta.url.
 *
 * Cached in memory per-edition keyed by editionNumber + updatedAt
 * timestamp, with a hard cap so a long-running process doesn't grow
 * unbounded. Cache busts whenever the edition is republished.
 */
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import type { Edition } from "../db/schema";

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
const AMBER_BRIGHT = "#F0C75E";
const FG = "#F0EDE8";
const FG_MUTED = "#9BA3B5";

/** D-Sunrise mark as JSX-style satori nodes. Geometry mirrors the
 *  canonical brand SVG; `stroke` honours `currentColor` via the colour
 *  prop set on the wrapping <svg>. */
function mark(size: number, color: string) {
  const w = Math.round((size * 240) / 280);
  return {
    type: "svg",
    props: {
      width: w,
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
              {
                type: "g",
                props: {
                  strokeWidth: 1.8,
                  children: [
                    [58, 173], [58, 160.6], [58, 146.3], [63.3, 132],
                    [75.3, 122.8], [89.3, 117], [104.3, 115], [119.3, 117],
                    [133.3, 122.8], [145.3, 132], [154.5, 144], [160.3, 158],
                    [162.3, 173],
                  ].map(([x2, y2]) => ({
                    type: "line",
                    props: { x1: 104.3, y1: 173, x2, y2 },
                  })),
                },
              },
            ],
          },
        },
      ],
    },
  };
}

function buildCard(edition: Edition) {
  const title =
    edition.socialTitle ??
    edition.metaTitle ??
    `Edition ${edition.editionNumber} · ${edition.weekRange}`;
  // OG titles must fit two lines; clamp generously to avoid satori
  // overflow truncation glitches.
  const headline = title.length > 110 ? `${title.slice(0, 107).trimEnd()}…` : title;

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "1200px",
        height: "630px",
        padding: "64px 72px",
        backgroundColor: NAVY,
        // Subtle amber radial bloom in the top-right corner.
        backgroundImage:
          "radial-gradient(circle at 88% 8%, rgba(212,168,83,0.16) 0%, transparent 55%)",
        color: FG,
        fontFamily: "Playfair Display",
        justifyContent: "space-between",
      },
      children: [
        // ── Top row: lockup
        {
          type: "div",
          props: {
            style: { display: "flex", alignItems: "center", gap: "16px" },
            children: [
              mark(54, AMBER),
              {
                type: "div",
                props: {
                  style: { display: "flex", flexDirection: "column", lineHeight: 1 },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "Playfair Display",
                          fontWeight: 700,
                          fontSize: "36px",
                          color: AMBER_BRIGHT,
                          letterSpacing: "-0.02em",
                        },
                        children: "The Desk",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "JetBrains Mono",
                          fontSize: "11px",
                          color: FG_MUTED,
                          letterSpacing: "0.22em",
                          marginTop: "8px",
                          textTransform: "uppercase",
                        },
                        children: "Intelligence",
                      },
                    },
                  ],
                },
              },
            ],
          },
        },

        // ── Middle: edition slug + headline
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "20px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontFamily: "JetBrains Mono",
                    fontSize: "13px",
                    color: AMBER,
                    letterSpacing: "0.28em",
                    textTransform: "uppercase",
                  },
                  children: `Edition No. ${edition.editionNumber} · Week of ${edition.weekOf}`,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontFamily: "Playfair Display",
                    fontWeight: 700,
                    fontSize: headline.length > 70 ? "56px" : "64px",
                    lineHeight: 1.02,
                    letterSpacing: "-0.025em",
                    color: FG,
                    maxWidth: "1056px",
                  },
                  children: headline,
                },
              },
            ],
          },
        },

        // ── Bottom: editorial rule + byline
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "20px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    width: "100%",
                    height: "1px",
                    backgroundImage: `linear-gradient(90deg, ${AMBER} 0%, rgba(212,168,83,0) 80%)`,
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
                          display: "flex",
                          fontFamily: "JetBrains Mono",
                          fontSize: "13px",
                          color: FG_MUTED,
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                        },
                        children: "By Ruben Laubscher · Head of Partnerships, InvestorKit",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          fontFamily: "JetBrains Mono",
                          fontSize: "13px",
                          color: FG_MUTED,
                          letterSpacing: "0.22em",
                          textTransform: "uppercase",
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
}

type CacheEntry = { key: string; png: Buffer };
const renderCache = new Map<number, CacheEntry>();
const CACHE_MAX = 64;

/** Stable cache key. publishedAt updates whenever an edition is
 *  republished, so the key busts naturally on edits. */
function cacheKey(edition: Edition): string {
  return `${edition.editionNumber}:${edition.publishedAt.getTime()}:${edition.socialTitle ?? edition.metaTitle ?? ""}`;
}

export async function renderEditionCard(edition: Edition): Promise<Buffer> {
  const key = cacheKey(edition);
  const hit = renderCache.get(edition.editionNumber);
  if (hit && hit.key === key) return hit.png;

  const fonts = await loadFonts();
  const tree = buildCard(edition);

  // `satori` accepts the JSX-like object tree directly. The `as any`
  // is the cost of skipping React on a server-only path, we're not
  // using JSX, just the shape satori expects.
  const svg = await satori(tree as never, {
    width: 1200,
    height: 630,
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

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
  });
  const png = Buffer.from(resvg.render().asPng());

  if (renderCache.size >= CACHE_MAX) {
    // Evict the oldest insertion-order entry. Map preserves insertion
    // order so the first key from the iterator is the oldest.
    const firstKey = renderCache.keys().next().value;
    if (firstKey !== undefined) renderCache.delete(firstKey);
  }
  renderCache.set(edition.editionNumber, { key, png });
  return png;
}
