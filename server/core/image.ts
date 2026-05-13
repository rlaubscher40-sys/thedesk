/**
 * Image generation via Manus built-in ImageService. Returns the S3-backed URL
 * we just uploaded the result to.
 */
import { env } from "./env";
import { storagePut } from "./storage";

export type GenerateImageOptions = {
  prompt: string;
};

export async function generateImage(options: GenerateImageOptions): Promise<{ url: string }> {
  if (!env.forgeApiUrl || !env.forgeApiKey) {
    throw new Error("Image generation requires BUILT_IN_FORGE_API_URL and _KEY");
  }
  const base = env.forgeApiUrl.endsWith("/") ? env.forgeApiUrl : `${env.forgeApiUrl}/`;
  const fullUrl = new URL("images.v1.ImageService/GenerateImage", base).toString();

  const res = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${env.forgeApiKey}`,
    },
    body: JSON.stringify({ prompt: options.prompt, original_images: [] }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Image generation failed (${res.status}) ${detail}`);
  }

  const result = (await res.json()) as { image: { b64Json: string; mimeType: string } };
  const buffer = Buffer.from(result.image.b64Json, "base64");
  return storagePut(`generated/${Date.now()}.png`, buffer, result.image.mimeType);
}
