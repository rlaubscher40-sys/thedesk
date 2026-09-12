import { DEFAULT_SPEECH_PROFILE } from "./localVoice";
import type { ScriptLine } from "./narration";
import { scriptFitsClip, type ReelStat } from "./statReel";
import { validateStoryboard } from "./storyboard";
import { assertCaptionStyle } from "../instagram/captionStyle";
import { REEL_CAPTION_LIMIT } from "../instagram/reelCaption";
import { validateEvidenceVisual } from "./evidenceVisual";
import { assertReelVisualSequence } from "./reelVisualStandard";

/** The approved settings are shared by review, admin preview and publication.
 * Auditions may override the low-level renderer, never the publishing wrapper. */
export function productionReelOptions(script?: ScriptLine[]) {
  return { script, narrate: true, subtitles: true, voice: DEFAULT_SPEECH_PROFILE } as const;
}

export type ProductionReelCandidate = {
  stat: ReelStat;
  script: ScriptLine[];
  caption: string;
  evidenceHash: string;
  publication: { key: string; date: string };
};

/** Reusable structural gate. Evidence adapters still own factual verification;
 * neither this check nor a populated brief proves that a story is compelling. */
export function assertProductionCandidate(candidate: ProductionReelCandidate) {
  const { stat, script, caption, publication } = candidate;
  if (!stat.source?.trim() || !stat.subtext?.trim())
    throw new Error("Reel needs visible source and reference context.");
  if (
    !/^[a-f0-9]{64}$/.test(candidate.evidenceHash) ||
    !publication.key.trim() ||
    !/^\d{4}-\d{2}-\d{2}$/.test(publication.date)
  )
    throw new Error("Reel needs verified evidence and a permanent publication identity.");
  if (
    !script.length ||
    new Set(script.map((line) => line.key)).size !== script.length ||
    script.some((line) => !line.key.trim() || !line.text.trim())
  )
    throw new Error("Reel needs complete, uniquely keyed narration.");
  if (!scriptFitsClip(script, stat)) throw new Error("Reel script exceeds its duration budget.");
  if (stat.storyboard) validateStoryboard(stat.storyboard, script);
  if (stat.visualStory) {
    validateEvidenceVisual(stat.visualStory, script, candidate.evidenceHash);
    assertReelVisualSequence(
      stat.visualStory.recipe,
      script.map((s) => s.key)
    );
    if (stat.source !== stat.visualStory.source)
      throw new Error("Visual source attribution changed.");
  } else if (stat.storyboard?.kind !== "housing-balance") {
    throw new Error("Automatic production requires a reviewed scene recipe.");
  } else
    assertReelVisualSequence(
      "housing-balance",
      script.map((s) => s.key)
    );
  if (!caption.trim() || caption.length > REEL_CAPTION_LIMIT)
    throw new Error("Reel needs a complete caption within the editorial budget.");
  assertCaptionStyle(caption);
}
