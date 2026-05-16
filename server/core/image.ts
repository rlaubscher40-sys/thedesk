/**
 * Image generation. Pluggable: when `OPENAI_API_KEY` is set, generates a hero
 * image via OpenAI gpt-image-1, compresses it to WebP, and returns a data URL
 * the caller can store directly on the edition row. When the env var is
 * missing, returns null and the caller falls back to the gradient placeholder.
 *
 * Two non-obvious decisions:
 *   1. gpt-image-1 returns binary in `b64_json` — it does NOT accept
 *      `response_format: "url"` (rejects the request) and it never issues
 *      URLs of its own. Earlier code asked for `url` and got nothing back,
 *      which is why every hero was empty.
 *   2. We compress the PNG to WebP at quality 78 before storing. The raw
 *      gpt-image-1 PNGs are 1-3MB which would bloat every edition query
 *      result. WebP at 78 typically lands in the 100-200KB range and is
 *      indistinguishable from the source at hero-image rendering sizes.
 *      Embedded as a data URL so we don't need an object store.
 */
import sharp from "sharp";
import { isDemoMode } from "../demo/store";
import { demoImage } from "../demo/imageStub";
import { env } from "./env";

export type GenerateImageOptions = {
  prompt: string;
};

export type GeneratedImage = { url: string } | null;

/**
 * Compress a raw PNG buffer to WebP and wrap as a data URL. Falls back to
 * the original PNG on any sharp error so a transient native-binary issue
 * doesn't lose the whole generation.
 */
async function compressToDataUrl(pngBuffer: Buffer): Promise<string> {
  try {
    const webp = await sharp(pngBuffer)
      .webp({ quality: 78, effort: 4 })
      .toBuffer();
    console.log(
      `[image] compressed ${pngBuffer.length} → ${webp.length} bytes (${Math.round(
        (webp.length / pngBuffer.length) * 100
      )}%)`
    );
    return `data:image/webp;base64,${webp.toString("base64")}`;
  } catch (err) {
    console.warn(
      "[image] sharp compression failed, storing PNG:",
      (err as Error).message
    );
    return `data:image/png;base64,${pngBuffer.toString("base64")}`;
  }
}

export async function generateImage(options: GenerateImageOptions): Promise<GeneratedImage> {
  if (isDemoMode()) return demoImage(options);
  if (!env.openAiApiKey) {
    console.warn("[image] skipped — OPENAI_API_KEY not set");
    return null;
  }

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.openAiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: options.prompt,
        n: 1,
        size: "1536x1024",
        quality: "medium",
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(
        `[image] generation failed ${res.status}: ${detail.slice(0, 400)}`
      );
      return null;
    }
    const data = (await res.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const item = data.data?.[0];
    if (!item) {
      console.warn("[image] response had no data array");
      return null;
    }
    // gpt-image-1 returns base64 — decode, compress to WebP, encode as a
    // data URL so the image survives the URL-expiry window and renders
    // inline without an object store.
    if (item.b64_json) {
      const pngBuffer = Buffer.from(item.b64_json, "base64");
      const url = await compressToDataUrl(pngBuffer);
      return { url };
    }
    // Fallback for DALL-E / any future model that emits URLs directly.
    if (item.url) return { url: item.url };
    console.warn("[image] response had no b64_json or url");
    return null;
  } catch (err) {
    console.warn("[image] generation error:", (err as Error).message);
    return null;
  }
}
