import { createCanvas, loadImage, type Image } from "@napi-rs/canvas";
import { renderEditorialFrame, renderEditorialLayer, type CardVariant } from "../og/instagramCards";
import { evidenceVisualLayout } from "./evidenceVisualLayout";
import { validateEvidenceVisual, type EvidenceVisual } from "./evidenceVisual";
import { splitMotion, unit } from "./reelMotion";

export async function createEvidenceMotionRenderer(
  v: EvidenceVisual,
  variant: CardVariant,
  scenes: Array<{ key: string; start: number; seconds: number }>,
  total: number
) {
  validateEvidenceVisual(v, v.script);
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
  const canvas = createCanvas(1080, 1920),
    ctx = canvas.getContext("2d");
  const background = variant === "light" ? "#F5F1E8" : "#0C1117";
  let current = "",
    plate: Image;
  const stamps = new Map<string, { content: string; image: Image }>();
  return async (time: number) => {
    if (!Number.isFinite(time) || time < 0 || time >= total)
      throw new Error("Frame outside Reel timeline.");
    const scene = scenes.findLast((s) => s.start <= time)!;
    // One action per spoken scene, then a deliberate reading hold. A later
    // scene that keeps the chart holds its final values instead of counting again.
    const p = unit((time - scene.start) / Math.max(0.3, scene.seconds * 0.65));
    const layout = evidenceVisualLayout(v, scene.key, p, variant);
    if (scene.key !== current) {
      current = scene.key;
      stamps.clear();
      const end = evidenceVisualLayout(v, scene.key, 1, variant);
      plate = await loadImage(
        await renderEditorialFrame(splitMotion(end.content).staticTree, variant, {
          ...end.meta,
          transparent: true,
        })
      );
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 1080, 1920);
    ctx.drawImage(plate!, 0, 0);
    for (const layer of splitMotion(layout.content).layers) {
      if (layer.opacity <= 0) continue;
      ctx.globalAlpha = unit(layer.opacity);
      if (layer.kind === "rect") {
        const style = layer.node.props.style;
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
          stamp = {
            content,
            image: await loadImage(await renderEditorialLayer(root, layer.width, layer.height)),
          };
          stamps.set(layer.id, stamp);
        }
        ctx.drawImage(stamp!.image, 84 + layer.x, 355 + layer.y);
      }
    }
    ctx.globalAlpha = 1;
    return canvas.data();
  };
}
