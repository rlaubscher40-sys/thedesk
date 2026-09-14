import { smooth } from "./reelMotion";

/** Reviewed illustrative shots, never evidence of a particular loan or lender. */
export const LOAN_SHOTS = {
  bank: {
    asset: "bank-etienne-martin.jpg",
    source: "https://unsplash.com/photos/grey-concrete-building-2_K82gx9Uk8",
    licence: "https://unsplash.com/license",
    reviewed: "2026-09-11",
    sha256: "c5c3813b3ea7e3ece390a0a03e40ef669f7b4e2236af2ea1de6efb33b3b9c01e",
    purpose: "Montr\u00e9al bank illustration, not an Australian lender or endorsement.",
    credit: "Bank illustration / Montréal / Etienne Martin / Unsplash",
    focus: 0.42,
  },
  money: {
    asset: "australian-money-pixabay.jpg",
    source: "https://www.pexels.com/video/australian-money-855198/",
    licence: "https://www.pexels.com/video/australian-money-855198/",
    reviewed: "2026-09-11",
    sha256: "f3d46ebc5355cb5e49569d56dbcf7bec1197e5212df209e8eb852402a5b2ec62",
    purpose: "Still extracted at four seconds; source identified CC0 at original review.",
    credit: "Australian money illustration / Pixabay / Pexels",
    focus: 0.3,
  },
  home: {
    asset: "architecture-phillip-flores.jpg",
    source: "https://unsplash.com/photos/mikcmWSjlMw/download?force=true",
    licence: "https://unsplash.com/license",
    reviewed: "2026-09-10",
    sha256: "86d3c4c6aefdc95ee191151f09eabbfe1f6901586302c5d47c96ea87ff2ddfc0",
    purpose:
      "Architecture illustration only; original review used gallery/download evidence, not individual metadata.",
    credit: "Architecture illustration / Phillip Flores / Unsplash",
    focus: 0.72,
  },
} as const;

export function loanShot(key: string): keyof typeof LOAN_SHOTS {
  if (key === "label") return "bank";
  if (["value", "line"].includes(key)) return "money";
  if (["claim", "facts", "signOff"].includes(key)) return "home";
  throw new Error(`Unreviewed loan photograph scene: ${key}`);
}

/** Share a camera clock across adjacent scenes so a retained chart never jumps. */
export function loanCameraProgress(
  key: string,
  time: number,
  scenes: Array<{ key: string; start: number; seconds: number }>
) {
  const group = scenes.filter((s) => loanShot(s.key) === loanShot(key));
  const first = group[0]!,
    last = group.at(-1)!;
  return smooth((time - first.start) / (last.start + last.seconds - first.start));
}

/** Cover the entire portrait canvas at every camera position, with no edge reveal. */
export function loanPhotoCrop(
  width: number,
  height: number,
  focus: number,
  progress: number,
  framing: { zoom?: number; verticalFocus?: number } = {}
) {
  const scale =
    Math.max(1080 / width, 1920 / height) * (1.015 + 0.035 * progress) * (framing.zoom ?? 1);
  const w = width * scale,
    h = height * scale;
  return {
    x: (1080 - w) * focus,
    y: (1920 - h) * (framing.verticalFocus ?? 0.35 + 0.2 * progress),
    width: w,
    height: h,
  };
}
