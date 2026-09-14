import type { DocumentaryEpisode } from "../instagram/documentaryEpisodes";
import type { MeasuredPhrase } from "./phraseSpeech";
import { DOCUMENTARY_DIRECTION } from "./documentaryDirection";
import { reelSceneShot } from "./reelVisualStandard";
import { seriesCuts, seriesShots } from "./documentarySeriesDirection";

export type DocumentaryTimeline = Array<{
  key: string;
  start: number;
  seconds: number;
  phrases: MeasuredPhrase[];
}>;

// Editorial names identify the image's job. Cut fractions remain in the director's
// timing file, shared with the actual renderer and score, rather than copied here.
const harryShots = [
  "Meet Harry|The survival question",
  "A childhood in Tianjin|Harry and his brother reach Sydney",
  "Textiles and travel|The taxi business|The milk round|Finish the Roseville house",
  "Buy the Tempe land|Build eight flats|Sell the block",
  "Meriton Street and 18 flats|Separate the apartment sales",
  "A public company|Buy back the company|The market turns",
  "Growth meets pressure|Reported debt|Repayment and retained apartments",
  "Cross state lines|The Queensland progression",
  "Build the apartment|Finance the buyer|Manage the property",
  "Regis before World Tower|Two recorded apartment contracts",
  "World Tower in context|Architectural scale|Occupation overlaps construction",
  "Keep the space|Equip the apartment|Operate the stay",
  "Buy during the GFC|Housing starts at scale",
  "Capital stays in retained stock|Borrow again",
  "Reported rental income|Income and profit differ",
  "Return to eight flats|Company-reported built total|The business behind the skyline",
].map((titles) => titles.split("|"));

export function documentaryShotPlan(episode: DocumentaryEpisode) {
  let phrase = 0;
  return episode.scenes.flatMap((scene) =>
    scene.phrases.map((text, phraseIndex) => {
      const shot = phrase++;
      const cuts: readonly number[] =
        episode.treatment === "series-led-v1"
          ? seriesCuts(episode.id)[shot]!
          : episode.treatment
            ? DOCUMENTARY_DIRECTION.cuts[shot]!
            : [0];
      const names =
        episode.treatment === "series-led-v1"
          ? seriesShots(episode.id, shot).map((s) => s.title)
          : episode.treatment
            ? harryShots[shot]!
            : [scene.headline];
      if (!cuts || names?.length !== cuts.length)
        throw new Error("Directed shot plan is incomplete.");
      return {
        sceneKey: scene.key,
        phraseIndex,
        text,
        sources: scene.sources,
        authored: Boolean(episode.treatment),
        shots: cuts.map((fraction, index) => ({
          id: `${scene.key}.${phraseIndex + 1}.${index + 1}`,
          title: names[index]!,
          fraction,
          endFraction: cuts[index + 1] ?? 1,
          // Bespoke treatments use several images inside a phrase. Their complete
          // verified asset register travels with the export instead of guessing one.
          recipePhoto: episode.treatment ? null : reelSceneShot(episode.recipe, scene.key),
        })),
      };
    })
  );
}

export function measuredDocumentaryShots(
  episode: DocumentaryEpisode,
  timeline: DocumentaryTimeline,
  total: number
) {
  if (!Number.isFinite(total) || total <= 0 || timeline.length !== episode.scenes.length)
    throw new Error("Review timeline is incomplete.");
  for (const [i, scene] of timeline.entries()) {
    if (
      scene.key !== episode.scenes[i]!.key ||
      !Number.isFinite(scene.start) ||
      scene.start < 0 ||
      (i > 0 && scene.start <= timeline[i - 1]!.start) ||
      !Number.isFinite(scene.seconds) ||
      scene.seconds <= 0 ||
      scene.start + scene.seconds > total + 0.05 ||
      scene.phrases.length !== episode.scenes[i]!.phrases.length ||
      scene.phrases.some(
        (p, j) =>
          p.text !== episode.scenes[i]!.phrases[j] ||
          !Number.isFinite(p.start) ||
          p.start < 0 ||
          !Number.isFinite(p.seconds) ||
          p.seconds <= 0 ||
          p.start + p.seconds > scene.seconds + 0.011 ||
          (j > 0 && p.start < scene.phrases[j - 1]!.start + scene.phrases[j - 1]!.seconds)
      )
    )
      throw new Error("Review timeline does not preserve the measured script.");
  }
  return documentaryShotPlan(episode).flatMap((phrase) => {
    const scene = timeline.find((s) => s.key === phrase.sceneKey)!;
    const measured = scene.phrases[phrase.phraseIndex]!;
    return phrase.shots.map((shot) => ({
      ...shot,
      sceneKey: scene.key,
      narration: phrase.text,
      sources: phrase.sources,
      start: scene.start + measured.start + measured.seconds * shot.fraction,
      end: scene.start + measured.start + measured.seconds * shot.endFraction,
      seconds: measured.seconds * (shot.endFraction - shot.fraction),
      // Sample late enough to inspect staged reveals, but still inside the shot.
      inspectAt:
        scene.start +
        measured.start +
        measured.seconds * (shot.fraction + (shot.endFraction - shot.fraction) * 0.75),
    }));
  });
}
