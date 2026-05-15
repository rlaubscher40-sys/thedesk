/**
 * Image generation. Pluggable: when `OPENAI_API_KEY` is set, generates a hero
 * image via OpenAI gpt-image-1. Otherwise returns `null` and the caller falls
 * back to the existing gradient placeholder + og:image pipeline.
 *
 * This is intentionally minimal — daily feed items rely on og:image scraped
 * from the source article, and only the weekly edition hero ever benefits
 * from AI generation. Skipping image gen entirely is a perfectly valid
 * production setup.
 */
import { isDemoMode } from "../demo/store";
import { demoImage } from "../demo/imageStub";
import { env } from "./env";

export type GenerateImageOptions = {
  prompt: string;
};

export type GeneratedImage = { url: string } | null;

export async function generateImage(options: GenerateImageOptions): Promise<GeneratedImage> {
  if (isDemoMode()) return demoImage(options);
  if (!env.openAiApiKey) {
    // Image generation is optional. Caller will use a gradient or og:image
    // fallback when this returns null.
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
        response_format: "url",
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(`[image] generation failed (${res.status}) ${detail.slice(0, 200)}`);
      return null;
    }
    const data = (await res.json()) as { data?: Array<{ url?: string }> };
    const url = data.data?.[0]?.url;
    if (!url) return null;
    return { url };
  } catch (err) {
    console.warn("[image] generation error:", (err as Error).message);
    return null;
  }
}
