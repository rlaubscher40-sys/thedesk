import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import satori, { type Font } from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { briefingClaimLabel, type BriefingSlide } from "../instagram/briefing";
import { sourceTimingLabel } from "../../shared/sourceTiming";

const FONT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fonts");
const div = (style: object, children: unknown) => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});
let fonts: Promise<Font[]> | undefined;
function loadFonts() {
  return (fonts ??= Promise.all(
    [
      ["Playfair", "PlayfairDisplay-Bold.woff", 700],
      ["Sans", "DeskEditorialSans-Regular.woff", 400],
      ["Mono", "JetBrainsMono-Regular.woff", 400],
    ].map(async ([name, file, weight]) => ({
      name: String(name),
      data: await fs.readFile(path.join(FONT_DIR, String(file))),
      weight: weight as 400 | 700,
      style: "normal" as const,
    }))
  ));
}
function lensIcon(key: string, i: number, color: string): string {
  const permit =
    '<rect x="28" y="14" width="64" height="92" rx="6"/><path d="M43 37h34M43 51h34M43 67h14m6 18 9 9 18-23"/>';
  const home = '<path d="M12 55 60 15l48 40M24 46v60h72V46M49 106V71h22v35"/>';
  const frame = '<path d="M12 55 60 15l48 40M24 46v60h72V46M24 106 96 46M24 46l72 60M60 20v85"/>';
  const overlap = '<circle cx="43" cy="60" r="31"/><circle cx="78" cy="60" r="31"/>';
  const percent =
    '<circle cx="33" cy="30" r="14"/><circle cx="87" cy="90" r="14"/><path d="m22 101 76-82"/>';
  const money =
    '<rect x="10" y="29" width="100" height="65" rx="6"/><circle cx="60" cy="61" r="21"/><path d="M24 61h6m60 0h6"/>';
  const clock = '<circle cx="60" cy="60" r="44"/><path d="M60 30v33l23 13"/>';
  const graphic =
    key === "stress"
      ? [home, money, overlap][i]
      : key === "supply"
        ? [permit, frame, home][i]
        : key === "rents"
          ? [money, percent, home][i]
          : key === "loans"
            ? [percent, permit, money][i]
            : [home, permit, clock][i];
  return `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><g fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${graphic}</g></svg>`).toString("base64")}`;
}
const photographs = {
  estimate: [
    "architecture-phillip-flores.jpg",
    "Architectural illustration · Phillip Flores / Unsplash",
  ],
  stress: ["sydney-construction-damon-hall.jpg", "Archive illustration · Damon Hall / Unsplash"],
  supply: ["sydney-construction-damon-hall.jpg", "Archive illustration · Damon Hall / Unsplash"],
  loans: ["australian-money-pixabay.jpg", "Illustration · Pixabay / Pexels"],
  rents: [
    "architecture-phillip-flores.jpg",
    "Architectural illustration · Phillip Flores / Unsplash",
  ],
  auction: [
    "architecture-phillip-flores.jpg",
    "Architectural illustration · Phillip Flores / Unsplash",
  ],
  general: [
    "architecture-phillip-flores.jpg",
    "Architectural illustration · Phillip Flores / Unsplash",
  ],
} as const;
const pictures = new Map<string, Promise<string>>();
async function photo(key: keyof typeof photographs) {
  const [file, credit] = photographs[key];
  if (!pictures.has(file))
    pictures.set(
      file,
      fs
        .readFile(path.join(FONT_DIR, file))
        .then((bytes) => `data:image/jpeg;base64,${bytes.toString("base64")}`)
    );
  return { src: await pictures.get(file)!, credit };
}

/** All live daily slides and admin previews use this exact renderer.
 * Illustrations are bundled and credited; no remote image URL or invented chart. */
export async function renderBriefingSlide(
  slide: BriefingSlide,
  index: number,
  count: number,
  variant: "navy" | "light" = "navy",
  vertical = false
): Promise<Buffer> {
  const light = variant === "light";
  const c = {
    bg: light ? "#F4F1EA" : "#0C1220",
    ink: light ? "#141B27" : "#F4F1EA",
    body: light ? "#343F4D" : "#C9D1DD",
    amber: light ? "#886018" : "#D4AB61",
    rule: light ? "#D6D1C6" : "#344052",
  };
  const height = vertical ? 1920 : 1350;
  const baseY = vertical ? 225 : 0;
  const label = (text: string, size = 21, color = c.amber) =>
    div({ fontFamily: "Mono", fontSize: size, color, letterSpacing: "0.08em" }, text);
  const heading = (text: string, size: number) =>
    div(
      {
        fontFamily: "Playfair",
        fontSize: size,
        fontWeight: 700,
        letterSpacing: "-0.035em",
        lineHeight: 1.08,
      },
      text
    );
  const body = (text: string, size = 35) =>
    div({ fontFamily: "Sans", fontSize: size, lineHeight: 1.38, color: c.body }, text);
  const shortDate = slide.story.feedDate;
  const children: unknown[] = [
    div(
      {
        position: "absolute",
        left: 76,
        top: baseY + 64,
        right: 76,
        justifyContent: "space-between",
      },
      [
        label("THE DESK", 24),
        label(
          `${String(index + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`,
          21,
          c.body
        ),
      ]
    ),
    div(
      {
        position: "absolute",
        left: 76,
        top: baseY + 125,
        right: 76,
        height: 1,
        backgroundColor: c.rule,
      },
      ""
    ),
  ];
  if (slide.kind === "cover") {
    const p = await photo(slide.lens.key);
    children.push(
      div(
        { position: "absolute", left: 76, top: baseY + 170 },
        label(`PROPERTY BRIEFING · ${briefingClaimLabel(slide.story)}`, 19)
      ),
      div(
        { position: "absolute", left: 76, top: baseY + 228, right: 76 },
        heading(
          slide.title,
          slide.title.length > 140
            ? 58
            : slide.title.length > 110
              ? 66
              : slide.title.length > 75
                ? 76
                : slide.title.length > 45
                  ? 88
                  : 118
        )
      ),
      div(
        {
          position: "absolute",
          left: 76,
          top: baseY + 630,
          right: 76,
          flexDirection: "column",
          gap: 12,
        },
        [body(slide.body, 29), label(`SOURCE · ${slide.story.source}`, 18, c.body)]
      ),
      {
        type: "img",
        props: {
          src: p.src,
          width: 1080,
          height: 440,
          style: { position: "absolute", left: 0, top: baseY + 730, objectFit: "cover" },
        },
      },
      div(
        {
          position: "absolute",
          left: 0,
          top: baseY + 1080,
          width: 1080,
          height: 90,
          backgroundImage: "linear-gradient(0deg, rgba(0,0,0,0.9), rgba(0,0,0,0))",
        },
        ""
      ),
      div({ position: "absolute", left: 76, top: baseY + 1130 }, label(p.credit, 17, "#FFFFFF")),
      div(
        {
          position: "absolute",
          left: 76,
          top: baseY + 1200,
          right: 76,
          justifyContent: "space-between",
        },
        [label(shortDate, 20, c.body), label("SWIPE TO UNDERSTAND →", 22)]
      )
    );
  } else if (slide.kind === "explainer") {
    children.push(
      div(
        { position: "absolute", left: 76, top: baseY + 170 },
        label("HOW TO READ IT · GENERAL GUIDE")
      ),
      div(
        { position: "absolute", left: 76, top: baseY + 235, right: 76 },
        heading(slide.title, 76)
      ),
      div({ position: "absolute", left: 76, top: baseY + 460, right: 76 }, body(slide.body, 35)),
      div(
        {
          position: "absolute",
          left: 76,
          top: baseY + 665,
          right: 76,
          flexDirection: "column",
          gap: 14,
        },
        slide.lens.points.map((point, i) =>
          div(
            { padding: "25px 26px", alignItems: "center", border: `1px solid ${c.rule}`, gap: 32 },
            [
              {
                type: "img",
                props: {
                  src: lensIcon(slide.lens.key, i, c.amber),
                  width: 92,
                  height: 92,
                  style: { flexShrink: 0 },
                },
              },
              div({ flexDirection: "column", gap: 6 }, [
                heading(point.label, 36),
                body(point.detail, 32),
              ]),
            ]
          )
        )
      )
    );
  } else if (slide.kind === "takeaway") {
    children.push(
      div({ position: "absolute", left: 76, top: baseY + 170 }, label("THE TAKEAWAY")),
      div(
        { position: "absolute", left: 76, top: baseY + 250, right: 76 },
        heading(slide.title, 88)
      ),
      div(
        {
          position: "absolute",
          left: 76,
          top: baseY + 520,
          right: 76,
          paddingLeft: 32,
          borderLeft: `5px solid ${c.amber}`,
        },
        body(slide.body, 46)
      ),
      div(
        {
          position: "absolute",
          left: 76,
          top: baseY + 925,
          right: 76,
          flexDirection: "column",
          gap: 20,
        },
        [
          heading("Keep the useful part.", 48),
          body("Save this for your next local market comparison.", 31),
          label("FULL STORIES & SOURCES → LINK IN BIO", 20),
        ]
      )
    );
  } else {
    const isEvidence = slide.kind === "evidence";
    children.push(
      div(
        { position: "absolute", left: 76, top: baseY + 170 },
        label(isEvidence ? "THE EVIDENCE · REPORTED DETAIL" : "ALSO IN THE BRIEFING")
      ),
      div(
        { position: "absolute", left: 76, top: baseY + 240, right: 76 },
        heading(slide.title, isEvidence ? 85 : slide.title.length > 110 ? 58 : 72)
      ),
      div(
        {
          position: "absolute",
          left: 76,
          top: baseY + (isEvidence ? 495 : 555),
          right: 76,
          paddingLeft: 30,
          borderLeft: `4px solid ${c.amber}`,
        },
        body(
          slide.body,
          isEvidence ? (slide.body.length > 320 ? 42 : 48) : slide.body.length > 320 ? 34 : 40
        )
      ),
      div(
        {
          position: "absolute",
          left: 76,
          top: baseY + 1010,
          right: 76,
          flexDirection: "column",
          gap: 14,
        },
        [
          label(`SOURCE · ${slide.story.source}`, 24),
          body(sourceTimingLabel(slide.story.sourceTiming), 23),
          label(`READ STORY ${slide.story.id} · THE DESK`, 20, c.body),
        ]
      )
    );
  }
  children.push(
    div(
      {
        position: "absolute",
        left: 76,
        top: baseY + 1270,
        right: 76,
        justifyContent: "space-between",
        borderTop: `1px solid ${c.rule}`,
        paddingTop: 18,
      },
      [label("AUSTRALIAN PROPERTY INTELLIGENCE", 16, c.body), label("THEDESK.AU", 18)]
    )
  );
  // Measure the actual font layout, not a guessed character count. Fit text
  // within its allocated region; fail before upload if readable type cannot fit.
  type LayoutNode = {
    type: string;
    props: { style?: Record<string, unknown>; children?: unknown; [key: string]: unknown };
  };
  const nodes = children as LayoutNode[];
  const tops = nodes.map((n) => Number(n.props.style?.top)).filter(Number.isFinite);
  for (const [i, node] of nodes.entries()) {
    const top = Number(node.props.style?.top);
    if (node.type !== "div" || !Number.isFinite(top) || !node.props.children) continue;
    node.props["data-layout-index"] = i;
    node.props["data-layout-bottom"] = Math.min(...tops.filter((t) => t > top), baseY + 1335) - 12;
  }
  function shrink(value: unknown, factor: number): void {
    if (Array.isArray(value)) {
      value.forEach((v) => shrink(v, factor));
      return;
    }
    if (!value || typeof value !== "object" || !("props" in value)) return;
    const node = value as LayoutNode;
    const style = node.props.style;
    if (style && typeof style.fontSize === "number") {
      const minimum = style.fontFamily === "Playfair" ? 48 : style.fontFamily === "Sans" ? 30 : 16;
      if (style.fontSize > minimum)
        style.fontSize = Math.max(minimum, Math.floor(style.fontSize * factor));
    }
    shrink(node.props.children, factor);
  }
  let svg = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const overflow: Array<{ index: number; factor: number }> = [];
    svg = await satori(
      div(
        { position: "relative", width: 1080, height, backgroundColor: c.bg, color: c.ink },
        children
      ) as never,
      {
        width: 1080,
        height,
        fonts: await loadFonts(),
        onNodeDetected(node) {
          const bottom = Number(node.props["data-layout-bottom"]);
          if (Number.isFinite(bottom) && node.top + node.height > bottom + 1)
            overflow.push({
              index: Number(node.props["data-layout-index"]),
              factor: ((bottom - node.top) / node.height) * 0.96,
            });
        },
      }
    );
    if (!overflow.length)
      return sharp(new Resvg(svg).render().asPng()).jpeg({ quality: 92 }).toBuffer();
    overflow.forEach((o) => shrink(nodes[o.index], o.factor));
  }
  throw new Error(`Briefing ${slide.kind} cannot fit at a readable type size`);
}
