import { createHash } from "node:crypto";
import { DOCUMENTARY_SOURCES, TRIGUBOFF_FINANCIAL_FACTS } from "../../shared/documentaryReels";
import type { DocumentaryEpisode } from "../instagram/documentaryEpisodes";
import type { ScriptLine } from "./narration";
import { REEL_SHOTS, REEL_VISUAL_SEQUENCES, assertReelVisualSequence } from "./reelVisualStandard";
import { DEFAULT_SPEECH_PROFILE } from "./localVoice";
import { REEL_SAFE_AREAS } from "./reelSafeAreas";
import { PERSON_DOCUMENTARY_ASSETS } from "./personDocumentaryRenderer";
import { DOCUMENTARY_DIRECTION } from "./documentaryDirection";

export type DocumentaryStory = DocumentaryEpisode & {
  version: 1;
  evidenceHash: string;
  binding: string;
};
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function documentaryScript(story: DocumentaryEpisode): ScriptLine[] {
  return story.scenes.map((s) => ({ key: s.key, text: s.phrases.join(" ") }));
}
function documentaryEvidence(story: DocumentaryEpisode) {
  return digest({
    id: story.id,
    period: story.period,
    scenes: story.scenes,
    sources: [...new Set(story.scenes.flatMap((s) => s.sources))].map((id) => [
      id,
      DOCUMENTARY_SOURCES[id],
    ]),
  });
}
export function sealDocumentary(episode: DocumentaryEpisode): DocumentaryStory {
  const data = {
    ...structuredClone(episode),
    version: 1 as const,
    evidenceHash: documentaryEvidence(episode),
  };
  return { ...data, binding: digest(data) };
}
export function validateDocumentary(
  story: DocumentaryStory,
  script: ScriptLine[],
  evidenceHash = story.evidenceHash
) {
  const { binding, ...data } = story;
  if (
    story.version !== 1 ||
    !["The Deal", "Property Empires"].includes(story.series) ||
    !["grollo-documentary", "meriton-documentary"].includes(story.recipe) ||
    !/^[a-z0-9-]+$/.test(story.id) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(story.releaseDate) ||
    !story.period.trim() ||
    (story.treatment !== undefined &&
      (story.treatment !== "person-led-v2" || story.id !== "triguboff-apartments")) ||
    story.scenes.length !== 8 ||
    story.scenes.some(
      (s) =>
        !s.chapter.trim() ||
        !s.headline.trim() ||
        s.headline.length > 60 ||
        (s.comparison &&
          (s.comparison.length !== 2 ||
            s.comparison.some(
              (c) =>
                !c.title.trim() || c.title.length > 20 || !c.detail.trim() || c.detail.length > 30
            ))) ||
        !s.detail.trim() ||
        s.detail.length > 85 ||
        !s.sources.length ||
        s.sources.some((id) => !Object.hasOwn(DOCUMENTARY_SOURCES, id)) ||
        s.phrases.length < 1 ||
        s.phrases.length > 2 ||
        s.phrases.some((t) => !t.trim() || t.length > 360)
    ) ||
    JSON.stringify(script) !== JSON.stringify(documentaryScript(story)) ||
    evidenceHash !== story.evidenceHash ||
    story.evidenceHash !== documentaryEvidence(story) ||
    binding !== digest(data)
  )
    throw new Error("Documentary evidence, scene copy and narration do not match.");
  assertReelVisualSequence(
    story.recipe,
    script.map((s) => s.key)
  );
}

/** Exact editorial/render inputs for a reviewed export. Bump rendererVersion when changing its layout. */
export function documentaryReviewHash(story: DocumentaryStory) {
  const sequence = REEL_VISUAL_SEQUENCES[story.recipe];
  return digest({
    story,
    rendererVersion: 8,
    direction: story.treatment ? DOCUMENTARY_DIRECTION : null,
    financialFacts: story.treatment ? TRIGUBOFF_FINANCIAL_FACTS : null,
    personAssets: story.treatment ? PERSON_DOCUMENTARY_ASSETS : null,
    voice: DEFAULT_SPEECH_PROFILE,
    safeAreas: REEL_SAFE_AREAS,
    sequence,
    shots: Object.values(sequence).map((key) => (key ? REEL_SHOTS[key] : null)),
  });
}
