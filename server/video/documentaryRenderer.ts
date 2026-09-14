import { createCanvas, loadImage, type Image } from "@napi-rs/canvas";
import { createHash } from "node:crypto";
import { loadAsset, renderEditorialFrame, renderEditorialLayer } from "../og/instagramCards";
import { validateDocumentary, documentaryScript, type DocumentaryStory } from "./documentaryStory";
import { REEL_SHOTS, reelSceneShot, reelCameraProgress } from "./reelVisualStandard";
import { loanPhotoCrop } from "./loanStoryPhotography";
import { smooth } from "./reelMotion";
import type { MeasuredPhrase } from "./phraseSpeech";
import { createPersonDocumentaryRenderer } from "./personDocumentaryRenderer";
import { createSeriesDocumentaryRenderer } from "./documentarySeriesRenderer";

const node = (style: object, children: unknown) => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});
const text = (top: number, copy: string, size: number, gold = false, serif = false) => ({
  type: "div",
  props: {
    "data-reel-safe-text": true,
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
    children: copy,
  },
});

/** Photographic chapters and original explanatory type. Actual phrases own every reveal.
 * All scenes reuse production typography, attribution and subtitle clearance. */
export async function createDocumentaryRenderer(
  story: DocumentaryStory,
  scenes: Array<{ key: string; start: number; seconds: number; phrases: MeasuredPhrase[] }>,
  total: number
) {
  validateDocumentary(story, documentaryScript(story));
  if (
    scenes.length !== story.scenes.length ||
    scenes.some(
      (s, i) =>
        s.key !== story.scenes[i]!.key ||
        !Number.isFinite(s.start) ||
        s.start < 0 ||
        !Number.isFinite(s.seconds) ||
        s.seconds <= 0 ||
        s.start + s.seconds > total + 0.05 ||
        !s.phrases?.length ||
        JSON.stringify(s.phrases.map((p) => p.text)) !== JSON.stringify(story.scenes[i]!.phrases)
    )
  )
    throw new Error("Documentary motion requires the complete measured script.");
  if (story.treatment === "person-led-v2")
    return createPersonDocumentaryRenderer(story, scenes, total);
  if (story.treatment === "series-led-v1")
    return createSeriesDocumentaryRenderer(story, scenes, total);
  const photos = new Map<string, Image>();
  for (const key of new Set(scenes.map((s) => reelSceneShot(story.recipe, s.key)))) {
    if (!key) continue;
    const shot = REEL_SHOTS[key];
    const bytes = await loadAsset(shot.asset);
    if (!bytes) throw new Error(`Reviewed documentary photograph is missing: ${shot.asset}`);
    if (
      "sha256" in shot &&
      createHash("sha256")
        .update(Buffer.from(bytes.split(",")[1]!, "base64"))
        .digest("hex") !== shot.sha256
    )
      throw new Error(`Reviewed documentary photograph changed: ${shot.asset}`);
    photos.set(key, await loadImage(bytes));
  }
  const canvas = createCanvas(1080, 1920),
    ctx = canvas.getContext("2d");
  let previous = "",
    plate: Image,
    detail: Image,
    comparison: Image | undefined;
  return async (time: number) => {
    if (!Number.isFinite(time) || time < 0 || time >= total)
      throw new Error("Frame outside documentary timeline.");
    const measured = scenes.findLast((s) => s.start <= time)!;
    const index = scenes.indexOf(measured),
      scene = story.scenes[index]!;
    const shotKey = reelSceneShot(story.recipe, scene.key);
    const source = scene.analysis
      ? "The Desk analysis / historical sources in bio"
      : scene.sources[0] === "grolloBiography"
        ? "ANU / Australian Dictionary of Biography"
        : scene.sources[0] === "grolloSpeech"
          ? "Property Council / Bruno Grollo's account"
          : scene.sources[0] === "meritonHistory"
            ? "Meriton Suites / company history"
            : "Property Council / profile, May 2015";
    if (scene.key !== previous) {
      previous = scene.key;
      const headlineTop = shotKey ? 510 : 260;
      const content = node({ position: "relative", width: 840, height: 925 }, [
        text(shotKey ? 448 : 170, scene.chapter, 25, true),
        text(headlineTop, scene.headline, scene.headline.length > 36 ? 64 : 76, false, true),
        ...(!shotKey ? [text(0, String(index + 1).padStart(2, "0"), 92, true, true)] : []),
        text(875, scene.analysis ? "THE DESK / WHAT THIS MEANS" : story.period, 25),
      ]);
      plate = await loadImage(
        await renderEditorialFrame(content, "navy", {
          kicker: `${story.series.toUpperCase()} / AUSTRALIAN PROPERTY`,
          source,
          index,
          count: scenes.length,
          documentary: true,
          quiet: true,
          transparent: true,
          photoCredit: shotKey
            ? REEL_SHOTS[shotKey].credit
            : "Original explanatory graphic / The Desk",
        })
      );
      detail = await loadImage(
        await renderEditorialLayer(
          node({ position: "relative", width: 840, height: 145 }, [
            text(0, scene.detail, 42, true),
          ]),
          840,
          145
        )
      );
      comparison = scene.comparison
        ? await loadImage(
            await renderEditorialLayer(
              node(
                { width: 840, height: 170, gap: 24 },
                scene.comparison.map((item) =>
                  node(
                    {
                      width: 408,
                      height: 170,
                      padding: 24,
                      border: "1px solid #C5A267",
                      flexDirection: "column",
                      gap: 14,
                    },
                    [
                      node(
                        { fontFamily: "Desk Editorial Sans", fontSize: 24, color: "#C5A267" },
                        item.title
                      ),
                      node(
                        {
                          fontFamily: "Desk Editorial Sans",
                          fontSize: 34,
                          lineHeight: 1.1,
                          color: "#F0EDE6",
                        },
                        item.detail
                      ),
                    ]
                  )
                )
              ),
              840,
              170
            )
          )
        : undefined;
    }
    ctx.fillStyle = "#0C1117";
    ctx.fillRect(0, 0, 1080, 1920);
    if (shotKey) {
      const shot = REEL_SHOTS[shotKey],
        photo = photos.get(shotKey)!;
      const crop = loanPhotoCrop(
        photo.width,
        photo.height,
        shot.focus,
        reelCameraProgress(story.recipe, time, index, scenes),
        {
          zoom: "zoom" in shot && typeof shot.zoom === "number" ? shot.zoom : undefined,
          verticalFocus:
            "verticalFocus" in shot && typeof shot.verticalFocus === "number"
              ? shot.verticalFocus
              : undefined,
        }
      );
      ctx.drawImage(photo, crop.x, crop.y, crop.width, crop.height);
      const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
      for (const [stop, alpha] of [
        [0, 0.62],
        [0.16, 0.6],
        [0.25, 0.08],
        [0.4, 0.12],
        [0.49, 0.84],
        [0.69, 0.96],
        [1, 0.98],
      ])
        gradient.addColorStop(stop!, `rgba(12,17,23,${alpha})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1080, 1920);
    }
    ctx.drawImage(plate!, 0, 0);
    const reveal = measured.phrases[1]?.start ?? Math.min(1, measured.seconds / 3);
    const progress = smooth((time - measured.start - reveal) / 0.5);
    ctx.fillStyle = "#C5A267";
    ctx.fillRect(84, shotKey ? 1080 : 850, 840 * progress, 3);
    ctx.globalAlpha = progress;
    ctx.drawImage(detail!, 84, shotKey ? 1100 : 875);
    if (comparison) ctx.drawImage(comparison, 84, 1025);
    ctx.globalAlpha = 1;
    return canvas.data();
  };
}
