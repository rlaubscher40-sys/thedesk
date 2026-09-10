import type { MeasuredPhrase } from "./phraseSpeech";

export const MOTION_FPS = 30;
export const unit = (n: number) => Math.max(0, Math.min(1, n));
/** Zero velocity at both ends, with no overshoot of evidence-based values. */
export const smooth = (n: number) => {
  const p = unit(n);
  return p * p * (3 - 2 * p);
};

/** Speech owns the start; movement finishes early enough to read the result. */
export function phraseMotion(seconds: number, cues: MeasuredPhrase[], duration: number) {
  if (!Number.isFinite(seconds) || !Number.isFinite(duration) || duration <= 0 || !cues.length)
    throw new Error("Motion requires a measured scene.");
  if (cues.length === 1)
    return unit(
      (seconds - cues[0]!.start) /
        Math.max(1 / MOTION_FPS, Math.min(cues[0]!.seconds - 0.08, duration - 0.45))
    );
  let progress = 0;
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i]!;
    if (seconds < cue.start) break;
    progress = (i + unit((seconds - cue.start) / (cue.seconds * 0.72))) / cues.length;
  }
  return progress;
}

export type MotionNode = { type: string; props: Record<string, any> };
export type MotionKind = "raster" | "rect" | "timeline";
export function moving(
  id: string,
  node: MotionNode,
  width = 840,
  height = 180,
  kind: MotionKind = "raster"
): MotionNode {
  return { ...node, props: { ...node.props, "data-motion": { id, width, height, kind } } };
}
export type MotionLayer = {
  id: string;
  x: number;
  y: number;
  opacity: number;
  width: number;
  height: number;
  kind: MotionKind;
  node: MotionNode;
};

/** Split absolute artwork into a stationary page and independently moving layers.
 * Layer bounds are authored, so a changing numeral cannot reflow the page. */
export function splitMotion(tree: MotionNode) {
  const layers: MotionLayer[] = [];
  function visit(value: any, x = 0, y = 0, alpha = 1): any {
    if (Array.isArray(value))
      return value.map((n) => visit(n, x, y, alpha)).filter((n) => n !== null);
    if (!value || typeof value !== "object" || !value.props) return value;
    const style = value.props.style ?? {};
    const left = x + (typeof style.left === "number" ? style.left : 0);
    const top = y + (typeof style.top === "number" ? style.top : 0);
    const opacity = alpha * (typeof style.opacity === "number" ? style.opacity : 1);
    const spec = value.props["data-motion"];
    if (spec) {
      layers.push({
        ...spec,
        x: left,
        y: top,
        opacity,
        node: {
          ...value,
          props: {
            ...value.props,
            "data-motion": undefined,
            style: { ...style, position: "absolute", left: 0, top: 0, opacity: 1 },
          },
        },
      });
      return null;
    }
    return {
      ...value,
      props: { ...value.props, children: visit(value.props.children, left, top, opacity) },
    };
  }
  return { staticTree: visit(tree) as MotionNode, layers };
}
