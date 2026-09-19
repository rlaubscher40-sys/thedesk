import { summariseReelLearning, type ReelLearningRow } from "../../shared/reelLearning";
import { DOCUMENTARY_READING } from "../../shared/documentaryReels";
import { readRecentReelPublications } from "../db/reelHistory";
import { readReelMetricPosts } from "../db/instagramPosts";
import { readReelStorySource } from "../db/reelStorySource";
import { readReelReview } from "../db/reelReviews";
import { reelRenderRecordSchema } from "../video/reelRenderRecord";
import { REEL_PUBLICATION_FAMILIES } from "./reelCandidates";
import { DOCUMENTARY_EPISODES } from "./documentaryEpisodes";
import { DOCUMENTARY_RELEASE_DATES } from "./documentaryReleasePlan";
import { documentaryCandidate, documentaryEpisodeReviewed } from "./verifiedDocumentaryReel";
import { reelPublicationRecord } from "./reelStatus";
import { documentaryRunway } from "./documentaryRunway";

export async function readReelOperations(now = new Date()) {
  const [receipts, episodes] = await Promise.all([
    readRecentReelPublications(Object.keys(REEL_PUBLICATION_FAMILIES)),
    Promise.all(
      DOCUMENTARY_EPISODES.map(async (episode) => ({
        id: episode.id,
        title: DOCUMENTARY_READING.find((item) => item.id === episode.id)!.title,
        releaseDate: DOCUMENTARY_RELEASE_DATES[episode.id] ?? null,
        exportRegistered: documentaryEpisodeReviewed(episode),
        state: (await reelPublicationRecord(documentaryCandidate(episode).publication)).state,
      }))
    ),
  ]);
  const metrics = new Map(
    (await readReelMetricPosts(receipts.map((receipt) => receipt.postId))).map((post) => [
      post.mediaId,
      post,
    ])
  );
  // Limit concurrency and total work. Read only; no provider calls, renders or writes.
  const posts = [];
  for (let offset = 0; offset < receipts.length; offset += 8) {
    posts.push(
      ...(await Promise.all(
        receipts.slice(offset, offset + 8).map(async (receipt) => {
          let render = null;
          let sourceState = "not-recorded";
          let review = null;
          let reviewState = "not-recorded";
          try {
            const source = await readReelStorySource(receipt);
            if (source?.render) {
              render = reelRenderRecordSchema.parse(source.render);
              sourceState = "recorded";
            }
          } catch {
            sourceState = "unavailable";
          }
          if (render) {
            try {
              review = await readReelReview({
                publication: { key: receipt.key, date: receipt.date },
                postId: receipt.postId,
                videoSha256: render.videoSha256,
              });
              if (review) reviewState = "recorded";
            } catch {
              reviewState = "unavailable";
            }
          }
          const metric = metrics.get(receipt.postId);
          return {
            publication: { key: receipt.key, date: receipt.date },
            postId: receipt.postId,
            publishedAt: receipt.publishedAt,
            headline: metric?.headline ?? receipt.key,
            family: REEL_PUBLICATION_FAMILIES[receipt.key] ?? "unknown",
            render,
            sourceState,
            review,
            reviewState,
            measurement: metric
              ? {
                  createdAt: receipt.publishedAt,
                  metricsFetchedAt: metric.metricsFetchedAt,
                  firstDayMetrics: metric.firstDayMetrics,
                  reach: metric.reach,
                  saved: metric.saved,
                  shares: metric.shares,
                }
              : null,
          };
        })
      ))
    );
  }
  const learningRows: ReelLearningRow[] = posts.map((post) => ({
    postId: post.postId,
    family: post.family,
    recipe: post.render?.recipe ?? null,
    // Old exports never inherit today's settings. A recorded old voice gets a
    // separate "delivery-unrecorded" cohort, without a claimed pacing profile.
    profile: post.render ? (post.render.delivery?.profile ?? "delivery-unrecorded") : null,
    voice: post.render
      ? `${post.render.voice.engine}/${post.render.voice.voice}/${post.render.voice.speed}`
      : null,
    seconds: post.render?.seconds ?? null,
    createdAt: post.publishedAt,
    metricsFetchedAt: null,
    ...post.measurement,
  }));
  return {
    generatedAt: now.toISOString(),
    historyLimit: 80,
    posts,
    learning: summariseReelLearning(learningRows),
    runway: documentaryRunway(episodes, now),
  };
}
