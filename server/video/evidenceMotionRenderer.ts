import { contextReelLayout, repaymentCueProgress } from "./contextReelLayout";
import { createCanvas, loadImage, type Image } from "@napi-rs/canvas";
import {
  loadAsset,
  renderEditorialFrame,
  renderEditorialLayer,
  type CardVariant,
} from "../og/instagramCards";
import { evidenceVisualLayout } from "./evidenceVisualLayout";
import { validateEvidenceVisual, type EvidenceVisual } from "./evidenceVisual";
import { rentComparisonLayout, rentCueProgress } from "./rentComparisonLayout";
import type { MeasuredPhrase } from "./phraseSpeech";
import { splitMotion, unit } from "./reelMotion";
import { loanPhotoCrop } from "./loanStoryPhotography";
import {
  REEL_SHOTS,
  reelSceneShot,
  reelCameraProgress,
  assertReelVisualSequence,
} from "./reelVisualStandard";
import { cinematicEvidenceLayout } from "./cinematicEvidenceLayout";
import { assertReelContentBottom } from "./reelSafeAreas";

export async function createEvidenceMotionRenderer(
  v: EvidenceVisual,
  variant: CardVariant,
  scenes: Array<{ key: string; start: number; seconds: number; phrases?: MeasuredPhrase[] }>,
  total: number
) {
  validateEvidenceVisual(v, v.script);
  assertReelVisualSequence(
    v.recipe,
    scenes.map((s) => s.key)
  );
  if (
    scenes.length !== v.script.length ||
    scenes.some(
      (s, i) =>
        s.key !== v.script[i]!.key ||
        !Number.isFinite(s.start) ||
        !Number.isFinite(s.seconds) ||
        s.seconds <= 0
    )
  )
    throw new Error("Evidence motion requires the complete measured script.");
  const isRent = v.recipe === "rent-comparison";
  const isContext = ["new-loan-rates", "interstate-migration"].includes(v.recipe);
  const measured = isRent || isContext;
  if (measured && scenes.some((s) => !s.phrases?.length))
    throw new Error("Comparison scenes need measured phrases.");
  const photos = new Map<string, Image>();
  for (const key of new Set(scenes.map((s) => reelSceneShot(v.recipe, s.key)))) {
    if (!key) continue;
    const shot = REEL_SHOTS[key],
      bytes = await loadAsset(shot.asset);
    if (!bytes) throw new Error(`Reviewed Reel photograph is missing: ${shot.asset}`);
    photos.set(key, await loadImage(bytes));
  }
  const canvas = createCanvas(1080, 1920),
    ctx = canvas.getContext("2d");
  const background = variant === "light" ? "#F5F1E8" : "#0C1117";
  let current = "",
    plate: Image;
  const stamps = new Map<string, { content: string; image: Image; textBottom: number }>();
  return async (time: number) => {
    if (!Number.isFinite(time) || time < 0 || time >= total)
      throw new Error("Frame outside Reel timeline.");
    const scene = scenes.findLast((s) => s.start <= time)!;
    // One action per spoken scene, then a deliberate reading hold. A later
    // scene that keeps the chart holds its final values instead of counting again.
    const p = unit((time - scene.start) / Math.max(0.3, scene.seconds * 0.65));
    const shotKey = reelSceneShot(v.recipe, scene.key);
    const photographic = shotKey !== null;
    const sceneVariant = photographic ? "navy" : variant;
    const layout =
      cinematicEvidenceLayout(v, scene.key, p) ??
      (measured
        ? (isContext ? contextReelLayout : rentComparisonLayout)(
            v,
            scene.key,
            {
              progress: p,
              ...(v.recipe === "new-loan-rates" && ["claim", "facts"].includes(scene.key)
                ? { repayment: repaymentCueProgress(scene.key, time - scene.start, scene.phrases!) }
                : {}),
              rates:
                scene.key === "value"
                  ? [
                      rentCueProgress(time - scene.start, scene.phrases!, 0),
                      rentCueProgress(time - scene.start, scene.phrases!, 1),
                    ]
                  : [1, 1],
            },
            sceneVariant
          )
        : evidenceVisualLayout(v, scene.key, p, sceneVariant));
    if (scene.key !== current) {
      current = scene.key;
      stamps.clear();
      const end = evidenceVisualLayout(v, scene.key, 1, sceneVariant);
      plate = await loadImage(
        await renderEditorialFrame(splitMotion(end.content).staticTree, sceneVariant, {
          ...end.meta,
          transparent: true,
        })
      );
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 1080, 1920);
    if (shotKey) {
      const shot = REEL_SHOTS[shotKey],
        image = photos.get(shotKey)!;
      const crop = loanPhotoCrop(
        image.width,
        image.height,
        shot.focus,
        reelCameraProgress(v.recipe, time, scenes.indexOf(scene), scenes),
        "zoom" in shot ? shot : {}
      );
      ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height);
      const hero = v.recipe !== "new-loan-rates" || ["label", "signOff"].includes(scene.key);
      const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
      gradient.addColorStop(0, "rgba(12,17,23,.7)");
      gradient.addColorStop(0.15, "rgba(12,17,23,.7)");
      gradient.addColorStop(0.23, "rgba(12,17,23,.12)");
      gradient.addColorStop(hero ? 0.42 : 0.3, hero ? "rgba(12,17,23,.2)" : "rgba(12,17,23,.65)");
      gradient.addColorStop(
        hero ? (v.recipe === "new-loan-rates" ? 0.59 : 0.49) : 0.46,
        "rgba(12,17,23,.87)"
      );
      gradient.addColorStop(0.72, "rgba(12,17,23,.96)");
      gradient.addColorStop(1, "rgba(12,17,23,.99)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1080, 1920);
    }
    ctx.drawImage(plate!, 0, 0);
    for (const layer of splitMotion(layout.content).layers) {
      if (layer.opacity <= 0) continue;
      ctx.globalAlpha = unit(layer.opacity);
      if (layer.kind === "rect") {
        const style = layer.node.props.style;
        assertReelContentBottom(355 + layer.y + style.height);
        ctx.fillStyle = style.backgroundColor;
        ctx.fillRect(84 + layer.x, 355 + layer.y, style.width, style.height);
      } else {
        const content = JSON.stringify(layer.node);
        let stamp = stamps.get(layer.id);
        if (stamp?.content !== content) {
          const root = {
            type: "div",
            props: {
              style: {
                display: "flex",
                position: "relative",
                width: layer.width,
                height: layer.height,
              },
              children: layer.node,
            },
          };
          let textBottom = 0;
          const bytes = await renderEditorialLayer(root, layer.width, layer.height, (bottom) => {
            textBottom = Math.max(textBottom, bottom);
          });
          stamp = {
            content,
            image: await loadImage(bytes),
            textBottom,
          };
          stamps.set(layer.id, stamp);
        }
        assertReelContentBottom(355 + layer.y + stamp!.textBottom);
        ctx.drawImage(stamp!.image, 84 + layer.x, 355 + layer.y);
      }
    }
    ctx.globalAlpha = 1;
    return canvas.data();
  };
}
