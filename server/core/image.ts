/**
 * Image generation. Pluggable: when `OPENAI_API_KEY` is set, generates a hero
 * image via OpenAI gpt-image-1, compresses to WebP via sharp, and returns the
 * raw bytes + content type. Callers are responsible for storing the bytes
 * (e.g. in the `edition_assets` table) and exposing them via a URL.
 *
 * Returning bytes rather than a data URL keeps every editions-list / get
 * query lightweight — storing a 250KB+ data URL inline in heroImageUrl
 * meant every page load shipped the image as text and triggered rendering
 * issues at scale.
 *
 * gpt-image-1 quirks worth knowing:
 *   - Does NOT accept `response_format`. Always returns base64 in `b64_json`.
 *   - Always returns binary, never a URL.
 *   - `quality` defaults to "low". "medium" is the right balance for a
 *     1536x1024 hero — sharper than low, half the cost of high.
 */
import sharp from "sharp";
import { isDemoMode } from "../demo/store";
import { demoImage } from "../demo/imageStub";
import { env } from "./env";

export type GenerateImageOptions = {
  prompt: string;
};

export type GeneratedImage = {
  bytes: Buffer;
  contentType: string;
} | null;

/**
 * Compress a raw PNG buffer to WebP. Falls back to the original PNG on
 * any sharp error so a transient native-binary issue doesn't lose the
 * whole generation.
 */
async function compressToWebp(
  pngBuffer: Buffer
): Promise<{ bytes: Buffer; contentType: string }> {
  try {
    const webp = await sharp(pngBuffer)
      .webp({ quality: 78, effort: 4 })
      .toBuffer();
    console.log(
      `[image] compressed ${pngBuffer.length} → ${webp.length} bytes (${Math.round(
        (webp.length / pngBuffer.length) * 100
      )}%)`
    );
    return { bytes: webp, contentType: "image/webp" };
  } catch (err) {
    console.warn(
      "[image] sharp compression failed, storing PNG:",
      (err as Error).message
    );
    return { bytes: pngBuffer, contentType: "image/png" };
  }
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<GeneratedImage> {
  if (isDemoMode()) {
    // Demo mode kept the old shape ({ url }) — translate so callers
    // upstream don't have to special-case it.
    const stub = await demoImage(options);
    if (!stub) return null;
    return null; // demo stays without binary; placeholders render client-side
  }
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
    if (item.b64_json) {
      const pngBuffer = Buffer.from(item.b64_json, "base64");
      return await compressToWebp(pngBuffer);
    }
    // Fallback for DALL-E / any future model that emits URLs directly —
    // fetch the binary so callers always get bytes to store.
    if (item.url) {
      const imgRes = await fetch(item.url);
      if (!imgRes.ok) {
        console.warn(`[image] follow-up fetch failed ${imgRes.status}`);
        return null;
      }
      const arrayBuffer = await imgRes.arrayBuffer();
      return await compressToWebp(Buffer.from(arrayBuffer));
    }
    console.warn("[image] response had no b64_json or url");
    return null;
  } catch (err) {
    console.warn("[image] generation error:", (err as Error).message);
    return null;
  }
}
