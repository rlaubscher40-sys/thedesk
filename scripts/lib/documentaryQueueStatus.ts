import { DOCUMENTARY_RELEASE_DATES } from "../../server/instagram/documentaryReleasePlan";
import {
  DOCUMENTARY_RELEASE_AUTHORISATION,
  DOCUMENTARY_REVIEWS,
} from "../../server/instagram/documentaryReviews";
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
        stage: z.enum([
          "blocked-review",
          "blocked-evidence-and-review",
          "authorised-for-scheduled-release",
        ]),
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
          approval: z.union([
            z.null(),
            z.object({
              kind: z.literal("user-release-authorisation"),
              author: z.literal("Ruben Laubscher"),
              date: z.literal("2026-09-17"),
              instruction: z.literal("I trust them to be good lets start posting etx"),
              fullListening: z.literal("not-performed"),
              continuousMotion: z.literal("not-reviewed"),
            }),
          ]),
        }),
        publication: z.object({
          key: z.string(),
          date,
          receiptStatus: z.literal("unavailable"),
          reservedSydneyDate: date.nullable(),
          legacyProvisionalDate: date,
        }),
      })
    )
    .min(1),
});

/** Read-only durable checkpoint. Live receipts and cross-programme checks are
 * separately read by the production scheduler; JSON is never proof of publication. */
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
    if (
      item.review.approval &&
      (JSON.stringify(item.review.approval) !== JSON.stringify(DOCUMENTARY_RELEASE_AUTHORISATION) ||
        item.export.videoSha256 !== DOCUMENTARY_REVIEWS[episode.id]?.videoSha256 ||
        item.publication.reservedSydneyDate !== DOCUMENTARY_RELEASE_DATES[episode.id])
    )
      throw new Error("Release authorisation or reserved date mismatch.");
    return {
      episodeId: item.episodeId,
      stage: item.stage,
      currentInputMatchesRecoveredExport:
        item.export.inputHash === documentaryReviewHash(sealDocumentary(episode)),
      legacySlotExpired: item.publication.legacyProvisionalDate < today,
      reservedSydneyDate: item.publication.reservedSydneyDate,
      approval: item.review.approval,
      receiptStatus: item.publication.receiptStatus,
    };
  });
  return {
    asOfSydneyDate: today,
    checkpointAt: queue.checkedAt,
    scope:
      "Read-only release checkpoint. Live readiness and receipts are in private scheduler logs.",
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
