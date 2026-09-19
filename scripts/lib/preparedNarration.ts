import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { PreparedNarration } from "../../server/video/phraseSpeech";

const manifestSchema = z.object({
  version: z.literal(1),
  episodeId: z.string().min(1),
  voice: z.object({
    engine: z.literal("elevenlabs"),
    voice: z.string().regex(/^[A-Za-z0-9]{10,80}$/),
    speed: z.number().min(0.9).max(1.1),
  }),
  model: z.literal("eleven_multilingual_v2"),
  clips: z
    .array(
      z.object({
        key: z.string().min(1),
        text: z.string().min(1),
        file: z.string().regex(/^[A-Za-z0-9_-]+\.wav$/),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        generationId: z.string().min(1),
      })
    )
    .min(1)
    .max(16),
});

/** Offline review input only. Bind exact scripts to immutable generated audio. */
export async function loadPreparedNarration(
  directory: string,
  episodeId: string
): Promise<PreparedNarration> {
  const manifest = manifestSchema.parse(
    JSON.parse(await fs.readFile(path.join(directory, "narration.json"), "utf8"))
  );
  if (manifest.episodeId !== episodeId)
    throw new Error("Prepared narration belongs to another episode.");
  const clips = await Promise.all(
    manifest.clips.map(async (clip) => {
      const bytes = await fs.readFile(path.join(directory, clip.file));
      if (createHash("sha256").update(bytes).digest("hex") !== clip.sha256)
        throw new Error("Prepared narration audio changed after generation.");
      return { key: clip.key, text: clip.text, bytes };
    })
  );
  return { voice: manifest.voice, clips };
}
