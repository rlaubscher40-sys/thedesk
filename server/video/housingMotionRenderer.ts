import { createCanvas, loadImage, type Image } from "@napi-rs/canvas";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import {
  loadAsset,
  renderEditorialFrame,
  renderEditorialLayer,
  type CardVariant,
} from "../og/instagramCards";
import {
  housingBalanceFrameLayout,
  housingDepositGeometry,
  type HousingBalanceStoryboard,
} from "./housingBalanceStoryboard";
import {
  MOTION_FPS,
  phraseMotion,
  smooth,
  splitMotion,
  unit,
  type MotionLayer,
} from "./reelMotion";
import type { MeasuredPhrase } from "./phraseSpeech";
import { assertReelVisualSequence, reelSceneShot, REEL_SHOTS } from "./reelVisualStandard";
import { loanPhotoCrop } from "./loanStoryPhotography";
import { assertReelContentBottom } from "./reelSafeAreas";

export type MotionScene = {
  key: string;
  start: number;
  seconds: number;
  phrases: MeasuredPhrase[];
};

/** A single camera move continues through construction and the final explanation. */
export function housingCamera(
  key: string,
  time: number,
  scenes: MotionScene[],
  total: number,
  image = { width: 1400, height: 986 },
  focus = 0.5
) {
  const opening = key === "label";
  const start = opening ? scenes[0]!.start : scenes.find((s) => s.key === "construction")!.start;
  const end = opening ? scenes[1]!.start : total;
  const p = smooth((time - start) / (end - start));
  const crop = loanPhotoCrop(image.width, image.height, focus, p);
  return { width: crop.width, height: crop.height, left: crop.x, top: crop.y };
}

/** Each output frame is evaluated at its own timestamp. Typography is cached
 * separately, so smooth motion never requires hundreds of full Satori pages. */
export async function createHousingMotionRenderer(
  story: HousingBalanceStoryboard,
  variant: CardVariant,
  scenes: MotionScene[],
  total: number
) {
  assertReelVisualSequence(
    "housing-balance",
    scenes.map((s) => s.key)
  );
  if (
    scenes.length !== story.scenes.length ||
    scenes.some((s, i) => s.key !== story.scenes[i]!.key || !s.phrases.length)
  )
    throw new Error("Continuous motion requires the complete measured storyboard.");
  const canvas = createCanvas(1080, 1920),
    ctx = canvas.getContext("2d");
  const c =
    variant === "light"
      ? { fg: "#171B21", muted: "#66635C", gold: "#946C29", rule: "#CEC7BA", bg: "#F5F1E8" }
      : { fg: "#F0EDE6", muted: "#A4A29C", gold: "#C5A267", rule: "#464A4D", bg: "#0C1117" };
  let sceneKey = "",
    plate: Image,
    photo: Image | undefined;
  // One cached stamp per slot: changing numbers cannot accumulate decoded images.
  const stamps = new Map<string, { key: string; image: Image; textBottom: number }>();
  async function raster(layer: MotionLayer) {
    const key = JSON.stringify(layer.node);
    let stamp = stamps.get(layer.id);
    if (!stamp || stamp.key !== key) {
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
        key,
        image: await loadImage(bytes),
        textBottom,
      };
      stamps.set(layer.id, stamp);
    }
    assertReelContentBottom(355 + layer.y + stamp.textBottom);
    ctx.drawImage(stamp.image, 84 + layer.x, 355 + layer.y);
  }
  return async (time: number) => {
    if (!Number.isFinite(time) || time < 0 || time >= total)
      throw new Error("Frame outside Reel timeline.");
    const scene = scenes.findLast((s) => s.start <= time)!;
    const progress = phraseMotion(time - scene.start, scene.phrases, scene.seconds);
    if (scene.key !== sceneKey) {
      sceneKey = scene.key;
      stamps.clear();
      const layout = housingBalanceFrameLayout(story, scene.key, 1, variant);
      const { staticTree } = splitMotion(layout.content);
      const shot = reelSceneShot("housing-balance", scene.key);
      const photographic = shot !== null;
      plate = await loadImage(
        await renderEditorialFrame(staticTree, variant, {
          ...layout.meta,
          transparent: true,
          ...(photographic
            ? { background: { type: "div", props: { style: { display: "flex" } } } }
            : {}),
        })
      );
      if (photographic) {
        const asset = await loadAsset(REEL_SHOTS[shot!].asset);
        if (!asset) throw new Error("Reviewed archive photograph is missing.");
        photo = await loadImage(asset);
      } else photo = undefined;
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, 1080, 1920);
    if (photo) {
      const shot = REEL_SHOTS[reelSceneShot("housing-balance", scene.key)!];
      const camera = housingCamera(scene.key, time, scenes, total, photo, shot.focus);
      ctx.drawImage(photo, camera.left, camera.top, camera.width, camera.height);
      const blend = scene.key === "signOff" ? smooth((time - scene.start) / 0.5) : 0;
      const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
      for (const [stop, alpha] of [
        [0, 0.6],
        [0.28, 0.15],
        [0.5, 0.65],
        [0.76, 0.96],
        [1, 0.98],
      ]) {
        const opacity = alpha! + (0.84 + 0.08 * stop! - alpha!) * blend;
        gradient.addColorStop(stop!, `rgba(12,17,23,${opacity})`);
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1080, 1920);
    }
    ctx.drawImage(plate!, 0, 0);
    const { layers } = splitMotion(
      housingBalanceFrameLayout(story, scene.key, progress, variant).content
    );
    for (const layer of layers) {
      if (layer.kind !== "raster") assertReelContentBottom(355 + layer.y + layer.height);
      if (layer.opacity <= 0) continue;
      ctx.globalAlpha = unit(layer.opacity);
      if (layer.kind === "rect") {
        const style = layer.node.props.style;
        ctx.fillStyle = style.backgroundColor;
        ctx.fillRect(84 + layer.x, 355 + layer.y, style.width, style.height);
      } else if (layer.kind === "timeline") {
        const x = 84 + layer.x,
          y = 355 + layer.y + 50;
        const dot = housingDepositGeometry(progress).dotX;
        const line = (a: number, b: number, colour: string, width: number) => {
          ctx.strokeStyle = colour;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(x + a, y);
          ctx.lineTo(x + b, y);
          ctx.stroke();
        };
        line(90, 750, c.rule, 3);
        line(90, dot, c.gold, 4);
        ctx.strokeStyle = c.muted;
        ctx.lineWidth = 2;
        for (const end of [90, 750]) {
          ctx.beginPath();
          ctx.moveTo(x + end, y - 16);
          ctx.lineTo(x + end, y + 16);
          ctx.stroke();
        }
        for (const [radius, colour, alpha] of [
          [28, c.gold, 0.12],
          [15, c.gold, 1],
          [5, c.fg, 1],
        ] as const) {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = colour;
          ctx.beginPath();
          ctx.arc(x + dot, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      } else await raster(layer);
    }
    ctx.globalAlpha = 1;
    // Match the existing quiet ending without changing the audio timeline.
    if (time > total - 0.35) {
      ctx.fillStyle = `rgba(12,17,23,${smooth((time - total + 0.35) / 0.35)})`;
      ctx.fillRect(0, 0, 1080, 1920);
    }
    return canvas.data();
  };
}

/** Stream with backpressure: bounded memory, exact cadence, no temporary still stack. */
export async function encodeMotionFrames(
  args: string[],
  total: number,
  frame: (time: number) => Promise<Buffer>
) {
  if (!ffmpegPath) throw new Error("ffmpeg binary unavailable");
  const child = spawn(ffmpegPath, args, { stdio: ["pipe", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (data) => {
    stderr = (stderr + data.toString()).slice(-32000);
  });
  const complete = new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`Motion encode failed (${code}): ${stderr}`))
    );
  });
  complete.catch(() => {});
  // Handle EPIPE even if the encoder exits while a frame is being rasterised.
  let pipeError: Error | undefined;
  child.stdin.on("error", (error) => {
    pipeError = error;
  });
  const timeout = setTimeout(() => child.kill("SIGKILL"), 240_000);
  try {
    for (let i = 0; i < Math.round(total * MOTION_FPS); i++) {
      const bytes = await frame(i / MOTION_FPS);
      if (pipeError || child.exitCode !== null)
        throw pipeError ?? new Error(`Encoder stopped: ${stderr}`);
      await new Promise<void>((resolve, reject) => {
        child.stdin.write(bytes, (error) => (error ? reject(error) : resolve()));
      });
    }
    child.stdin.end();
    await complete;
  } catch (error) {
    child.kill("SIGKILL");
    await complete.catch(() => {});
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
