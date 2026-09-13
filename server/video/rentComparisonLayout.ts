import type { CardVariant } from "../og/instagramCards";
import type { EvidenceVisual } from "./evidenceVisual";
import { evidenceBarGeometry } from "./evidenceVisual";
import { moving, smooth, unit, type MotionNode } from "./reelMotion";
import type { MeasuredPhrase, PhrasePlan } from "./phraseSpeech";

const box = (style: Record<string, unknown>, children: unknown): MotionNode => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});
const at = (left: number, top: number, children: unknown, style: Record<string, unknown> = {}) =>
  box({ position: "absolute", left, top, width: 840 - left, ...style }, children);

/** Sentence boundaries exclude decimal points. The exact verified text survives. */
export function rentPhrasePlan(v: EvidenceVisual): PhrasePlan[] {
  return v.script.map((s) => ({ ...s, phrases: s.text.split(/(?<=[.!?])\s+(?=[A-Z])/u) }));
}
export function rentCueProgress(time: number, phrases: MeasuredPhrase[], index: number) {
  const cue = phrases[index];
  if (!cue) throw new Error("The rent comparison requires its measured narration cues.");
  return smooth((time - cue.start) / Math.max(0.2, cue.seconds * 0.72));
}
export type RentMotion = { progress: number; rates: [number, number] };

/** The same bars and city labels survive the evidence and interpretation scenes.
 * A missing price is explicitly unknown; no hypothetical dollar data are drawn. */
export function rentComparisonLayout(
  v: EvidenceVisual,
  key: string,
  motion: RentMotion,
  variant: CardVariant
) {
  const c =
    variant === "light"
      ? { fg: "#171B21", muted: "#66635C", gold: "#946C29", track: "#DED8CD" }
      : { fg: "#F0EDE6", muted: "#A4A29C", gold: "#C5A267", track: "#30363C" };
  const text = (s: string, size = 44, colour = c.fg, face = "sans", maxHeight?: number) => {
    const n = box(
      {
        width: "100%",
        fontFamily:
          face === "serif"
            ? "Playfair Display"
            : face === "italic"
              ? "Desk Editorial Italic"
              : "Desk Editorial Sans",
        fontWeight: face === "serif" ? 700 : face === "italic" ? 500 : 400,
        fontStyle: face === "italic" ? "italic" : "normal",
        fontSize: size,
        color: colour,
        lineHeight: 1.14,
      },
      s
    );
    n.props["data-reel-safe-text"] = true;
    if (maxHeight) n.props["data-reel-max-height"] = maxHeight;
    return n;
  };
  const type = (
    id: string,
    x: number,
    y: number,
    value: string,
    size: number,
    colour = c.fg,
    width = 840,
    opacity = 1,
    face = "sans"
  ) =>
    moving(
      id,
      at(x, y, text(value, size, colour, face), { width, opacity }),
      width,
      Math.ceil(size * 2.4)
    );
  const rect = (
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    colour: string,
    opacity = 1
  ) =>
    moving(
      id,
      at(x, y, "", { width: w, height: h, backgroundColor: colour, opacity }),
      Math.max(1, w),
      Math.max(1, h),
      "rect"
    );
  const p = unit(motion.progress),
    eased = smooth(p);
  const values = v.rows.map((r) => r.value);
  const gap = Math.abs(values[0]! - values[1]!);
  const full = evidenceBarGeometry(values, 1, 640);
  const nodes: MotionNode[] = [];
  const heading = (a: string, b: string) => [
    at(0, 0, text(a, 78, c.fg, "serif", 100)),
    at(0, 108, text(b, 61, c.gold, "italic", 85)),
  ];
  const compact = key === "claim" ? eased : key === "facts" ? 1 : 0;
  const showChart = ["value", "line", "claim", "facts"].includes(key);

  if (key === "label") {
    nodes.push(
      at(0, 160, text("Brisbane.", 104, c.fg, "serif", 125)),
      at(0, 285, text("Perth.", 104, c.fg, "serif", 125)),
      at(0, 465, text("What does rent", 67, c.gold, "italic", 85)),
      at(0, 550, text("growth tell you?", 67, c.gold, "italic", 85)),
      type("intro-period", 0, 735, v.period, 31, c.muted, 840, eased),
      at(0, 845, text("ILLUSTRATIVE ARCHITECTURE", 23, c.muted)),
      at(0, 885, text("Phillip Flores / Unsplash", 25, c.muted))
    );
  } else if (key === "value" || key === "line") {
    nodes.push(...heading("Two rent markets.", "One comparable measure."));
    if (key === "line") {
      nodes.push(
        type("gap-figure", 0, 675, `${gap.toFixed(1)}`, 168, c.gold, 360, eased, "serif"),
        type("gap-unit", 350, 718, "percentage points", 41, c.fg, 490, eased),
        type("gap-period", 350, 775, v.period, 29, c.muted, 490, eased)
      );
      // The bracket spans the actual endpoints, including reversed and signed values.
      const endpoints = full.bars.map((b, i) => (values[i]! < 0 ? b.left : b.left + b.width));
      const lo = Math.min(...endpoints),
        hi = Math.max(...endpoints);
      nodes.push(
        rect("gap-left", lo, 570, 2, 50, c.gold, eased),
        rect("gap-right", hi, 570, 2, 50, c.gold, eased),
        rect("gap-span", lo, 615, (hi - lo) * eased, 2, c.gold)
      );
    } else
      nodes.push(
        type(
          "rate-definition",
          0,
          775,
          "Rents actually paid / annual change",
          32,
          c.muted,
          840,
          eased
        )
      );
  } else if (key === "claim") {
    nodes.push(...heading("Growth tells us pace.", "What about the price?"));
    nodes.push(
      type("weekly-label", 0, 650, "Weekly rent", 42, c.muted, 500, eased),
      type("weekly-unknown", 570, 620, "$ ?", 100, c.fg, 270, eased, "serif"),
      rect("unknown-rule", 0, 775, 840 * eased, 2, c.gold),
      type(
        "unknown-note",
        0,
        815,
        "These rates do not tell us which city is dearer.",
        43,
        c.fg,
        840,
        eased
      )
    );
  } else if (key === "facts") {
    nodes.push(...heading("Buying an investment?", "Growth is one clue."));
    nodes.push(
      type("price-input", 0, 650, "Purchase price", 46, c.fg, 690, eased),
      type("price-question", 750, 640, "?", 62, c.gold, 80, eased, "serif"),
      rect("cost-rule", 0, 735, 840 * eased, 2, c.track),
      type("cost-input", 0, 790, "Ownership costs", 46, c.fg, 690, smooth(p * 2 - 0.5)),
      type("cost-question", 750, 780, "?", 62, c.gold, 80, smooth(p * 2 - 0.5), "serif")
    );
  } else if (key === "signOff") {
    nodes.push(
      at(0, 110, text("Rent growth", 99, c.fg, "serif", 125)),
      at(0, 235, text("isn't rental yield.", 73, c.gold, "italic", 95)),
      rect("ending-rule", 0, 440, 840 * eased, 3, c.gold),
      type("takeaway", 0, 510, "Check rent, price and costs.", 51, c.fg, 840, eased),
      at(0, 765, text("Read the full comparison", 38, c.gold)),
      at(0, 830, text("Link in bio / Brisbane vs Perth rents", 30, c.muted)),
      at(0, 885, text("Illustrative architecture / Phillip Flores", 23, c.muted))
    );
  } else throw new Error(`Missing rent scene: ${key}`);

  if (showChart) {
    // Row coordinates interpolate across the claim transition. Evidence is never
    // reset to zero when its meaning is explained in the next scene.
    for (let i = 0; i < 2; i++) {
      const rp = key === "value" ? motion.rates[i]! : 1;
      const geo = evidenceBarGeometry(values, rp, 640);
      const row = v.rows[i]!;
      const y = (300 + i * 190) * (1 - compact) + (265 + i * 130) * compact;
      const opacity = key === "facts" ? 0.6 : 1;
      nodes.push(
        type(`city-${i}`, 0, y, row.label, 37, c.muted, 600, opacity),
        type(
          `number-${i}`,
          560,
          y - 35,
          `${(row.value * rp).toFixed(1)}%`,
          84,
          i === 0 ? c.gold : c.fg,
          280,
          key === "value" && rp === 0 ? 0 : opacity,
          "serif"
        ),
        rect(`track-${i}`, 0, y + 67, 640, 15, c.track, opacity),
        rect(
          `fill-${i}`,
          geo.bars[i]!.left,
          y + 67,
          geo.bars[i]!.width,
          15,
          i === 0 ? c.gold : c.fg,
          opacity
        ),
        rect(`zero-${i}`, geo.zero, y + 59, 2, 31, c.muted, opacity)
      );
    }
  }
  return {
    content: box({ width: 840, height: 980, position: "relative" }, nodes),
    meta: {
      kicker: "BRISBANE / PERTH / RENT MARKETS",
      source: v.source,
      publisher: "Australian Bureau of Statistics",
      documentary: true,
      quiet: true,
      index: v.script.findIndex((s) => s.key === key),
      count: v.script.length,
    },
  };
}
