import { DOCUMENTARY_EPISODES } from "../../server/instagram/documentaryEpisodes";
import { documentaryReviewHash, sealDocumentary } from "../../server/video/documentaryStory";
import { documentaryLaunchReady } from "../../server/instagram/verifiedDocumentaryReel";
import { sydneySocialClock } from "../../shared/instagramSchedule";
import { z } from "zod";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const date = z.iso.date();
const queueSchema = z.object({
  version: z.literal(1),
  checkedAt: z.iso.datetime(),
  blockers: z.array(z.string().min(1)),
  episodes: z
    .array(
      z.object({
        subjectId: z.string().min(1),
        episodeId: z.string().min(1),
        family: z.enum(["documentary-deal", "documentary-empires"]),
        firstRecordedDate: date,
        stage: z.enum(["blocked-review", "blocked-evidence-and-review"]),
        selectionReason: z.string().min(1),
        underlyingEvent: z.string().min(1),
        centralTakeaway: z.string().min(1),
        candidateSourceLinks: z.array(z.url()).min(1),
        unresolvedEvidence: z.array(z.string()),
        export: z.object({ inputHash: hash, videoSha256: hash, seconds: z.number().positive() }),
        review: z.object({
          technical: z.literal("previously-passed"),
          sampledFrames: z.literal("previously-inspected"),
          fullListening: z.literal("blocked"),
          continuousMotion: z.literal("not-reviewed"),
          approval: z.null(),
        }),
        publication: z.object({
          key: z.string(),
          date,
          receiptStatus: z.literal("unavailable"),
          reservedSydneyDate: z.null(),
          legacyProvisionalDate: date,
        }),
      })
    )
    .min(1),
});

/** Recovery ledger preflight only. Never approves, reschedules, renders or posts.
 * Deliberately accepts only held recovery records. A ready-state transition needs
 * a separate reviewed implementation, not a JSON edit that invents approval. */
export function documentaryQueueStatus(input: unknown, now: Date) {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid status clock.");
  const queue = queueSchema.parse(input);
  const today = sydneySocialClock(now).dateISO;
  const ids = queue.episodes.map((item) => item.episodeId);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate episode identity.");
  const exports = queue.episodes.map((item) => item.export.videoSha256);
  if (new Set(exports).size !== exports.length) throw new Error("Duplicate export identity.");
  const items = queue.episodes.map((item) => {
    const episode = DOCUMENTARY_EPISODES.find((e) => e.id === item.episodeId);
    if (!episode) throw new Error(`Unregistered episode: ${item.episodeId}`);
    const family = episode.series === "The Deal" ? "documentary-deal" : "documentary-empires";
    if (item.family !== family) throw new Error("Episode family mismatch.");
    if (
      item.publication.key !== `instagram-reel-documentary-${episode.id}-v1` ||
      item.publication.date !== "2026-09-14"
    )
      throw new Error("Permanent receipt identity changed.");
    return {
      episodeId: item.episodeId,
      stage: item.stage,
      currentInputMatchesRecoveredExport:
        item.export.inputHash === documentaryReviewHash(sealDocumentary(episode)),
      legacySlotExpired: item.publication.legacyProvisionalDate < today,
      reservedSydneyDate: null,
      approval: null,
      receiptStatus: item.publication.receiptStatus,
    };
  });
  return {
    asOfSydneyDate: today,
    checkpointAt: queue.checkedAt,
    scope: "Read-only recovery preflight, not publishing enforcement or creative approval",
    runtimeLaunchGateReady: documentaryLaunchReady(),
    verifiedReviewedUnpublishedCount: 0,
    nextContinuation: [...queue.episodes].sort((a, b) =>
      a.firstRecordedDate.localeCompare(b.firstRecordedDate)
    )[0]!.episodeId,
    newProductionNeeded: false,
    blockers: queue.blockers,
    episodes: items,
  };
}
