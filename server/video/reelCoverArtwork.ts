import { createCanvas, loadImage } from "@napi-rs/canvas";
import { loadAsset, renderEditorialLayer } from "../og/instagramCards";
import { assertReviewedPhotoBytes, type ReviewedPhoto } from "./assetRights";

export type CoverArtwork = {
  treatment: "portrait" | "photograph" | "split";
  photo: ReviewedPhoto & { focus: number; verticalFocus?: number };
  section: string;
  headline: string;
  subject?: string;
  figure?: string;
  detail: string;
  period: string;
  source: string;
};

/** A still-image system, independent of the video's opening animation.
 * Essential story copy stays within x=84..924, y=420..1500. Secondary source
 * details remain in the 3:4 crop; full attribution stays on the 9:16 export. */
export async function renderCoverArtwork(cover: CoverArtwork): Promise<Buffer> {
  const asset = await loadAsset(cover.photo.asset);
  if (!asset) throw new Error(`Reviewed Reel cover photograph is missing: ${cover.photo.asset}`);
  assertReviewedPhotoBytes(cover.photo, asset);
  const photo = await loadImage(asset);
  const canvas = createCanvas(1080, 1920),
    ctx = canvas.getContext("2d");
  const cream = "#F2EDE3",
    ink = "#101923",
    gold = "#D5B67C";
  const split = cover.treatment === "split";
  ctx.fillStyle = split ? cream : ink;
  ctx.fillRect(0, 0, 1080, 1920);

  // Reframe the still, rather than inheriting an animated camera's zoom.
  const photoHeight = split ? 1000 : 1920;
  const zoom = cover.treatment === "portrait" ? 2.3 : 1;
  const scale = Math.max(1080 / photo.width, photoHeight / photo.height) * zoom;
  const w = photo.width * scale,
    h = photo.height * scale;
  const x = (1080 - w) * cover.photo.focus;
  const y =
    cover.treatment === "portrait"
      ? 780 - h * 0.46
      : (photoHeight - h) * (cover.photo.verticalFocus ?? 0.4);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 1080, photoHeight);
  ctx.clip();
  ctx.drawImage(photo, x, y, w, h);
  ctx.restore();

  // Preserve a clear image window; darken only the text-bearing areas.
  const shade = ctx.createLinearGradient(0, 0, 0, 1920);
  const stops = split
    ? [
        [0, 0.08],
        [0.23, 0.68],
        [0.38, 0],
        [0.52, 0],
        [1, 0],
      ]
    : [
        [0, 0.1],
        [0.23, 0.68],
        [0.4, 0.02],
        [0.49, 0.12],
        [0.61, 0.82],
        [0.76, 0.98],
        [1, 1],
      ];
  for (const [stop, alpha] of stops) shade.addColorStop(stop!, `rgba(10,18,26,${alpha})`);
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 1080, 1920);
  if (split) {
    ctx.fillStyle = cream;
    ctx.fillRect(0, 1000, 1080, 920);
  }

  const text = async (
    value: string,
    top: number,
    size: number,
    height: number,
    color = cream,
    serif = false,
    minSize = size
  ) => {
    for (let fontSize = size; fontSize >= minSize; fontSize -= 2) {
      try {
        const layer = await renderEditorialLayer(
          {
            type: "div",
            props: {
              "data-reel-safe-text": true,
              "data-reel-max-height": height,
              style: {
                display: "flex",
                width: 840,
                fontFamily: serif ? "Playfair Display" : "Desk Editorial Sans",
                fontWeight: serif ? 700 : 400,
                fontSize,
                lineHeight: 1.06,
                whiteSpace: "pre-wrap",
                color,
              },
              children: value,
            },
          },
          840,
          height
        );
        ctx.drawImage(await loadImage(layer), 84, top);
        return;
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !error.message.includes("authored bounds") ||
          fontSize - 2 < minSize
        )
          throw error;
      }
    }
  };
  await text("The Desk", 450, 48, 62, cream, true);
  await text(cover.section.toUpperCase(), 531, 25, 38, gold);
  ctx.fillStyle = gold;
  ctx.fillRect(84, 583, 54, 4);

  const fg = split ? ink : cream,
    accent = split ? "#74562D" : gold;
  const subjectTop = cover.figure ? 1040 : 1015;
  if (cover.subject) await text(cover.subject.toUpperCase(), subjectTop, 35, 48, accent);
  if (cover.figure) {
    await text(cover.figure, 1100, 182, 204, fg, true, 144);
    await text(cover.headline, 1315, 60, 135, fg, true, 52);
  } else {
    await text(cover.headline, 1090, 104, 345, fg, true, 76);
  }
  await text(cover.detail, 1515, 30, 64, fg);
  ctx.fillStyle = split ? "#C9BCA6" : "#50606B";
  ctx.fillRect(84, 1586, 840, 1);
  await text(cover.period, 1608, 23, 58, fg);
  await text(cover.source, 1698, 22, 62, fg);
  await text(cover.photo.credit, 1780, 20, 90, split ? "#675F54" : "#C6C9C9");
  return canvas.encode("jpeg", 93);
}
