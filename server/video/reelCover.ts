import { createCanvas, loadImage } from "@napi-rs/canvas";
import { loadAsset, renderEditorialLayer } from "../og/instagramCards";
import type { ReelStat } from "./statReel";
import type { ScriptLine } from "./narration";
import { validateEvidenceVisual } from "./evidenceVisual";
import { validateStoryboard } from "./storyboard";
import { matchedHousingBalance } from "../../shared/housingBalance";
import { evidenceOpening, housingOpening } from "./reelOpening";
import { assertReelVisualSequence, reelSceneShot, REEL_SHOTS } from "./reelVisualStandard";
import { loanPhotoCrop } from "./loanStoryPhotography";

export function reelCoverContent(stat: ReelStat, script: ScriptLine[]) {
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

/** All essential copy stays inside the centre square (y=420..1500), also
 * retained by a centre 3:4 crop. The full portrait remains photographic. */
export async function renderReelCover(stat: ReelStat, script: ScriptLine[]) {
  const cover = reelCoverContent(stat, script);
  const asset = await loadAsset(cover.shot.asset);
  if (!asset) throw new Error(`Reviewed Reel cover photograph is missing: ${cover.shot.asset}`);
  const photo = await loadImage(asset);
  const canvas = createCanvas(1080, 1920),
    ctx = canvas.getContext("2d");
  const crop = loanPhotoCrop(photo.width, photo.height, cover.shot.focus, 0.35);
  ctx.drawImage(photo, crop.x, crop.y, crop.width, crop.height);
  const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
  for (const [stop, alpha] of [
    [0, 0.3],
    [0.3, 0.6],
    [0.42, 0.78],
    [0.62, 0.94],
    [1, 0.98],
  ])
    gradient.addColorStop(stop!, `rgba(12,17,23,${alpha})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1920);
  const line = (
    top: number,
    text: string,
    size: number,
    height: number,
    gold = false,
    serif = false
  ) => ({
    type: "div",
    props: {
      "data-reel-safe-text": true,
      "data-reel-max-height": height,
      style: {
        display: "flex",
        position: "absolute",
        left: 0,
        top,
        width: 840,
        fontFamily: serif ? "Playfair Display" : "Desk Editorial Sans",
        fontWeight: serif ? 700 : 400,
        fontSize: size,
        lineHeight: 1.12,
        color: gold ? "#C5A267" : "#F0EDE6",
      },
      children: text,
    },
  });
  const layer = await renderEditorialLayer(
    {
      type: "div",
      props: {
        style: { display: "flex", position: "relative", width: 840, height: 1000 },
        children: [
          line(0, "The Desk", 52, 65, false, true),
          line(82, "THE EVIDENCE / EXPLAINED", 24, 35, true),
          line(350, cover.opening.headline, 82, 280, false, true),
          line(650, cover.opening.detail, 38, 100, true),
          line(780, cover.period, 27, 65),
          line(880, cover.source, 24, 100),
        ],
      },
    },
    840,
    1000
  );
  ctx.drawImage(await loadImage(layer), 84, 460);
  const credit = await renderEditorialLayer(
    {
      type: "div",
      props: {
        style: {
          display: "flex",
          width: 840,
          fontFamily: "Desk Editorial Sans",
          fontSize: 22,
          color: "#C0BDB5",
        },
        children: cover.shot.credit,
      },
    },
    840,
    90
  );
  ctx.drawImage(await loadImage(credit), 84, 1710);
  return canvas.encode("jpeg", 90);
}
