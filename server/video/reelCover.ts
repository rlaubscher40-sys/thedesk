import type { ReelStat } from "./statReel";
import type { ScriptLine } from "./narration";
import { validateEvidenceVisual } from "./evidenceVisual";
import { validateStoryboard } from "./storyboard";
import { matchedHousingBalance } from "../../shared/housingBalance";
import { evidenceOpening, housingOpening } from "./reelOpening";
import { assertReelVisualSequence, reelSceneShot, REEL_SHOTS } from "./reelVisualStandard";
import { validateDocumentary } from "./documentaryStory";
import { renderCoverArtwork, type CoverArtwork } from "./reelCoverArtwork";

export function reelCoverContent(stat: ReelStat, script: ScriptLine[]) {
  if (stat.documentary) {
    validateDocumentary(stat.documentary, script);
    const story = stat.documentary;
    const shot = reelSceneShot(story.recipe, "label");
    if (!shot) throw new Error("Documentary cover needs its opening photograph.");
    return {
      recipe: story.recipe,
      shot: REEL_SHOTS[shot],
      opening: {
        headline:
          story.treatment === "person-led-v2" ? "Harry Triguboff." : story.scenes[0]!.headline,
        detail:
          story.treatment === "person-led-v2"
            ? "Eight flats were the beginning."
            : story.scenes[0]!.detail,
        voice: script[0]!.text,
      },
      period: story.period,
      source: story.series,
    };
  }
  const visual = stat.visualStory;
  const story = stat.storyboard;
  if (story) validateStoryboard(story, script);
  if (visual) {
    validateEvidenceVisual(visual, script);
    if (stat.source !== visual.source) throw new Error("Reel cover source attribution changed.");
  } else if (story?.kind !== "housing-balance")
    throw new Error("Reel cover needs a reviewed recipe.");
  const recipe = visual?.recipe ?? "housing-balance";
  assertReelVisualSequence(
    recipe,
    script.map((s) => s.key)
  );
  const shot = reelSceneShot(recipe, "label");
  if (!shot) throw new Error("Reel cover requires its reviewed opening photograph.");
  const balance = story?.kind === "housing-balance" ? matchedHousingBalance(story.evidence) : null;
  return {
    recipe,
    shot: REEL_SHOTS[shot],
    opening: visual
      ? evidenceOpening(visual.recipe, visual.rows)
      : housingOpening(
          balance!.shortfall,
          story!.kind === "housing-balance" ? story!.opening : "question"
        ),
    period: visual?.period ?? balance!.period,
    source: stat.source!,
  };
}

/** Derive each cover from validated evidence, with a hook authored for a still. */
export function reelCoverDesign(stat: ReelStat, script: ScriptLine[]): CoverArtwork {
  const content = reelCoverContent(stat, script);
  const design: CoverArtwork = {
    treatment: "photograph",
    photo: content.shot,
    section: stat.documentary?.series ?? "The evidence",
    headline: content.opening.headline,
    detail: content.opening.detail,
    period: content.period,
    source: content.source,
  };
  if (stat.documentary?.id === "triguboff-apartments") {
    return {
      ...design,
      treatment: "portrait",
      subject: "Harry Triguboff",
      headline: "Eight flats.\nThen an empire.",
      detail: "The making of Meriton.",
      period: "Meriton / founded 1963",
    };
  }
  if (stat.documentary?.id === "grollo-family") {
    return {
      ...design,
      treatment: "split",
      subject: "The Grollos",
      headline: "The family behind\nthe skyline.",
      detail: "From concreting to Melbourne's towers.",
      period: "The family business / founded 1948",
    };
  }
  if (stat.documentary?.id === "grollo-ownership") {
    return {
      ...design,
      subject: "Bruno + Rino Grollo",
      headline: "Build it.\nOwn a share.",
      detail: "The move beyond construction.",
    };
  }
  const visual = stat.visualStory;
  if (visual?.recipe === "interstate-migration") {
    const value = visual.rows[0]!.value;
    return {
      ...design,
      treatment: "split",
      section: "Population",
      subject: "Queensland",
      figure: `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toLocaleString("en-AU")}`,
      headline:
        value === 0
          ? "No net interstate change."
          : value > 0
            ? "Net interstate arrivals."
            : "Net interstate departures.",
      detail: "Arrivals minus departures. Across state borders.",
    };
  }
  if (visual?.recipe === "supply-checklist") {
    return {
      ...design,
      subject: "Greater Sydney",
      section: "Housing supply",
      headline: "Approved.\nWhen built?",
      detail: `${visual.rows[0]!.value.toLocaleString("en-AU")} dwelling approvals. Timing matters.`,
    };
  }
  if (visual?.recipe === "new-loan-rates") {
    return {
      ...design,
      section: "Borrowing",
      subject: "Same loan. Shorter term.",
      headline: "Five fewer years.\nWhat changes?",
      detail: "The trade-off in monthly repayments.",
    };
  }
  if (stat.storyboard?.kind === "housing-balance" && stat.storyboard.opening === "question") {
    const balance = matchedHousingBalance(stat.storyboard.evidence)!;
    return {
      ...design,
      section: "Supply + demand",
      subject: "Australia's new housing gap",
      figure: `~${balance.shortfall.toLocaleString("en-AU")}`,
      headline: "Homes short.",
      detail: "New supply fell behind estimated new demand.",
    };
  }
  if (visual?.recipe === "capital-rents" || visual?.recipe === "rent-comparison") {
    design.treatment = "split";
    design.section = "Rents";
    design.subject = "Annual rent change";
  }
  if (visual?.recipe === "rent-change") design.subject = "Annual rent change / Sydney";
  if (visual?.recipe === "approval-comparison") design.subject = "Brisbane + Perth";
  if (stat.storyboard?.kind === "housing-balance" && stat.storyboard.opening === "consequence")
    design.subject = "Modelled deposit-saving time";
  return design;
}

/** The production publisher and offline review use exactly the same renderer. */
export async function renderReelCover(stat: ReelStat, script: ScriptLine[]) {
  return renderCoverArtwork(reelCoverDesign(stat, script));
}
