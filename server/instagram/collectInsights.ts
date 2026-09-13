import { fetchMediaMetricsResult } from "./api";
import { listInstagramPostsNeedingMetrics, updateInstagramPostMetrics } from "../db/instagramPosts";

/** Sequential bounded reads. An inaccessible old post must not abort its neighbours. */
export async function collectInstagramInsights(accessToken: string) {
  const posts = await listInstagramPostsNeedingMetrics(undefined, true);
  const summary = {
    selected: posts.length,
    complete: 0,
    partial: 0,
    unavailable: 0,
    failed: 0,
    deferred: 0,
    persistenceFailed: 0,
  };
  for (const post of posts) {
    try {
      const result = await fetchMediaMetricsResult({ mediaId: post.mediaId, accessToken });
      summary[result.status]++;
      const persisted = await updateInstagramPostMetrics(post.mediaId, result.metrics, result);
      if (!persisted) summary.persistenceFailed++;
      console.log(
        "[instagram-insights] " +
          JSON.stringify({
            mediaId: post.mediaId,
            status: result.status,
            reason: result.reason,
            persisted,
            observedAt: new Date().toISOString(),
            publishedAt: post.createdAt ?? null,
            metrics: result.metrics,
          })
      );
      if (result.reason === "rate_limited" || result.reason === "access_denied") {
        summary.deferred =
          posts.length - summary.complete - summary.partial - summary.unavailable - summary.failed;
        break;
      }
    } catch {
      summary.failed++;
      console.warn(
        "[instagram-insights] " +
          JSON.stringify({
            mediaId: post.mediaId,
            status: "failed",
            reason: "collection_failed",
            persisted: false,
          })
      );
    }
  }
  console.log("[instagram-insights] summary " + JSON.stringify(summary));
  return summary;
}
