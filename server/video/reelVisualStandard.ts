import type { EvidenceRecipe } from "./evidenceVisual";
import { LOAN_SHOTS } from "./loanStoryPhotography";
import { smooth } from "./reelMotion";
import { REEL_PHOTO_CATALOGUE } from "./reelPhotoCatalogue";
import { DOCUMENTARY_PHOTOS } from "../../shared/documentaryPhotos";

export const REEL_SHOTS = {
  ...DOCUMENTARY_PHOTOS,
  ...LOAN_SHOTS,
  ...REEL_PHOTO_CATALOGUE,
  moving: {
    asset: "moving-home-cottonbro.jpg",
    source:
      "https://images.pexels.com/photos/4554242/pexels-photo-4554242.jpeg?cs=srgb&dl=pexels-cottonbro-4554242.jpg&fm=jpg",
    licence: "https://www.pexels.com/license/",
    reviewed: "2026-09-12",
    sha256: "11bcc8a3663a1b4727affd220fcd5ececcb84f3133f321c636d7e7ab9413dc5e",
    purpose:
      "Moving illustration, not a named household or measured migration route. Gallery/download evidence at original review.",
    credit: "Moving-home illustration / cottonbro studio / Pexels",
    focus: 0.5,
  },
  construction: {
    asset: "sydney-construction-damon-hall.jpg",
    source:
      "https://unsplash.com/photos/a-very-tall-building-with-a-crane-on-top-of-it-jzEkzVq3Yp0",
    licence: "https://unsplash.com/license",
    reviewed: "2026-09-10",
    sha256: "3242c737991f5100629fcfad7f6e74fbd2abc357547ea6d7737e8eefdd483691",
    purpose:
      "Sydney construction archive; not current footage or evidence of delay at this building.",
    credit: "Sydney construction archive / Damon Hall / Unsplash",
    focus: 0.5,
  },
} as const;
export type ReelVisualRecipe =
  | EvidenceRecipe
  | "housing-balance"
  | "grollo-documentary"
  | "meriton-documentary";
export type ReelShot = keyof typeof REEL_SHOTS;

/** Null means an intentionally clean evidence graphic, never an unreviewed
 * fallback. Every production recipe explicitly covers its complete script. */
export const REEL_VISUAL_SEQUENCES: Record<ReelVisualRecipe, Record<string, ReelShot | null>> = {
  "grollo-documentary": {
    label: "rialtoArchive",
    value: null,
    line: "money",
    turn: null,
    mechanism: null,
    stakes: "rialtoArchive",
    meaning: null,
    signOff: "rialtoArchive",
  },
  "meriton-documentary": {
    label: "triguboffArchive",
    value: null,
    line: "meritonArchive",
    turn: "triguboffArchive",
    mechanism: null,
    stakes: "meritonArchive",
    meaning: null,
    signOff: "meritonArchive",
  },
  "new-loan-rates": {
    label: "bank",
    value: "money",
    line: "money",
    claim: "home",
    facts: "home",
    signOff: "residential",
  },
  "interstate-migration": {
    label: "moving",
    value: null,
    line: "moving",
    claim: "residential",
    facts: "building",
    signOff: "neighbourhood",
  },
  "rent-comparison": {
    label: "residential",
    value: null,
    line: null,
    claim: null,
    facts: "money",
    signOff: "neighbourhood",
  },
  "capital-rents": {
    label: "neighbourhood",
    value: null,
    line: null,
    claim: "money",
    facts: null,
    signOff: "residential",
  },
  "rent-change": {
    label: "home",
    value: null,
    line: null,
    claim: "money",
    facts: null,
    signOff: "residential",
  },
  "approval-comparison": {
    label: "construction",
    value: null,
    line: null,
    construction: "building",
    completion: "residential",
    facts: null,
    claim: null,
    signOff: "neighbourhood",
  },
  "supply-checklist": {
    label: "building",
    value: null,
    line: "building",
    claim: "neighbourhood",
    facts: "construction",
    signOff: "residential",
  },
  "housing-balance": {
    label: "neighbourhood",
    facts: null,
    claim: null,
    households: null,
    construction: "building",
    signOff: "building",
  },
};

export function reelSceneShot(recipe: ReelVisualRecipe, key: string): ReelShot | null {
  const sequence = REEL_VISUAL_SEQUENCES[recipe];
  if (!sequence || !Object.hasOwn(sequence, key))
    throw new Error(`Missing reviewed visual sequence: ${recipe}/${key}`);
  return sequence[key]!;
}

export function assertReelVisualSequence(recipe: ReelVisualRecipe, keys: string[]) {
  const sequence = REEL_VISUAL_SEQUENCES[recipe];
  if (!sequence || JSON.stringify(Object.keys(sequence)) !== JSON.stringify(keys))
    throw new Error("Automatic Reel needs a complete reviewed visual sequence.");
  const shots = keys.map((key) => reelSceneShot(recipe, key));
  if (
    !shots[0] ||
    !shots.at(-1) ||
    !shots.slice(1, -1).some(Boolean) ||
    shots.some((shot) => shot && !REEL_SHOTS[shot])
  )
    throw new Error("Automatic Reel needs full-screen opening, explanation and takeaway imagery.");
}

/** Only adjacent shots share a clock. Returning to an earlier shot starts a
 * new cut; moving between retained chart scenes never resets the camera. */
export function reelCameraProgress(
  recipe: ReelVisualRecipe,
  time: number,
  index: number,
  scenes: Array<{ key: string; start: number; seconds: number }>
) {
  const shot = reelSceneShot(recipe, scenes[index]!.key);
  let first = index,
    last = index;
  while (first > 0 && reelSceneShot(recipe, scenes[first - 1]!.key) === shot) first--;
  while (last + 1 < scenes.length && reelSceneShot(recipe, scenes[last + 1]!.key) === shot) last++;
  return smooth(
    (time - scenes[first]!.start) /
      (scenes[last]!.start + scenes[last]!.seconds - scenes[first]!.start)
  );
}
