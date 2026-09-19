import { deliveryReviewSchema, type DeliveryReview } from "./narrationDelivery";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ReelStat } from "./statReel";
import { REEL_SAFE_AREAS } from "./reelSafeAreas";
import { REEL_VISUAL_SEQUENCES } from "./reelVisualStandard";
import { reelVoiceIdentity, type ReelVoiceEngine, type ReelVoiceIdentity } from "./reelVoice";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const coordinate = z.number().finite().min(0).max(1920);
export const reelRenderRecordSchema = z.object({
  version: z.literal(1),
  videoSha256: hash,
  coverSha256: hash,
  buildCommit: z
    .string()
    .regex(/^[a-f0-9]{40}$/)
    .nullable(),
  recipe: z
    .string()
    .refine((value) => Object.hasOwn(REEL_VISUAL_SEQUENCES, value))
    .nullable(),
  seconds: z.number().finite().positive().max(180),
  narrated: z.boolean(),
  subtitled: z.boolean(),
  voice: z.object({
    engine: z.enum(["local-kokoro", "elevenlabs"]),
    voice: z.string().min(1).max(80),
    speed: z.number().finite().positive().max(4),
  }),
  delivery: deliveryReviewSchema.optional(),
  safeAreas: z.object({
    sceneBottom: coordinate,
    contentBottom: coordinate,
    attributionTop: coordinate,
    attributionBottom: coordinate,
    subtitleTop: coordinate,
    subtitleCentreY: coordinate,
    subtitleBottom: coordinate,
    storyFooterTop: coordinate,
    storyFooterCentreY: coordinate,
    storyFooterBottom: coordinate,
  }),
});
export type ReelRenderRecord = z.infer<typeof reelRenderRecordSchema>;

/** Fingerprint the actual submitted bytes and the options used for this render.
 * This is export provenance, not evidence that Meta published or served them. */
export function captureReelRender(
  video: {
    bytes: Buffer;
    seconds: number;
    narrated: boolean;
    subtitled: boolean;
    /** The speaker actually heard, when the render reported one. */
    spokenBy?: ReelVoiceEngine | null;
    /** Exact identity attached to saved audio; independent of today's configuration. */
    voice?: ReelVoiceIdentity;
    delivery?: DeliveryReview;
  },
  cover: Buffer,
  stat: ReelStat,
  voice: { voice: string; speed: number },
  buildCommit = process.env.RAILWAY_GIT_COMMIT_SHA
): ReelRenderRecord {
  return reelRenderRecordSchema.parse({
    version: 1,
    videoSha256: createHash("sha256").update(video.bytes).digest("hex"),
    coverSha256: createHash("sha256").update(cover).digest("hex"),
    buildCommit: buildCommit && /^[a-f0-9]{40}$/.test(buildCommit) ? buildCommit : null,
    recipe:
      stat.documentary?.recipe ??
      stat.visualStory?.recipe ??
      (stat.storyboard?.kind === "housing-balance" ? "housing-balance" : null),
    seconds: video.seconds,
    narrated: video.narrated,
    subtitled: video.subtitled,
    voice: video.voice ?? reelVoiceIdentity(voice, video.spokenBy),
    ...(video.delivery ? { delivery: video.delivery } : {}),
    safeAreas: { ...REEL_SAFE_AREAS },
  });
}
