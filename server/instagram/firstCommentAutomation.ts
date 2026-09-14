import { env } from "../core/env";
import { isDemoMode } from "../demo/store";
import { claimJobRun, markJobRun, readJobRun } from "../db/jobRuns";
import {
  COMMENT_DATE,
  firstCommentKey,
  firstCommentPause,
  pauseFirstComments,
  pendingFirstComments,
  readFirstCommentReceipt,
} from "../db/instagramFirstComments";
import { recordServerError } from "../db/health";
import {
  createMediaComment,
  fetchCommentExists,
  isRateLimitError,
  type MediaMetricsResult,
} from "./api";
import { instagramCooldownActive } from "./post";
import { validMetricCount } from "../../shared/instagramMeasurement";

/** Existing five-minute scheduler only. One send per tick, one permanent claim
 * per media ID. No backfill, duplicate scheduler or retry of an uncertain POST. */
export async function runFirstCommentAutomation(now = new Date()) {
  const { instagramAccessToken: accessToken, instagramBusinessAccountId: accountId } = env;
  if (isDemoMode() || !env.enableScheduler || !env.scheduledApiKey || !accessToken || !accountId)
    return { state: "disabled" };
  if (instagramCooldownActive()) return { state: "cooldown" };
  const pause = await firstCommentPause(accountId);
  if (pause && now.getTime() - pause.startedAt.getTime() < 24 * 60 * 60_000)
    return { state: "paused", reason: pause.detail };
  for (const source of await pendingFirstComments(now, accountId)) {
    const key = firstCommentKey(source.mediaId);
    if (await readJobRun(key, COMMENT_DATE)) continue;
    // Replicas share a dispatch claim, so separate posts cannot create a burst.
    const dispatchKey = `ig-comment-tick-${accountId}-${Math.floor(now.getTime() / 300_000)}`;
    if (!(await claimJobRun(dispatchKey, COMMENT_DATE, 1))) return { state: "busy" };
    if (!(await claimJobRun(key, COMMENT_DATE, 1))) return { state: "busy" };
    try {
      const commentId = await createMediaComment({
        mediaId: source.mediaId,
        accessToken,
        message: source.message,
      });
      const detail = JSON.stringify({ version: 1, mediaId: source.mediaId, commentId });
      await markJobRun(key, COMMENT_DATE, "success", detail);
      const saved = await readJobRun(key, COMMENT_DATE);
      if (saved?.status !== "success" || saved.detail !== detail)
        throw new Error("Comment receipt unavailable; preserve permanent claim.");
      return { state: "published", mediaId: source.mediaId, commentId };
    } catch (error) {
      const accessDenied = /"code":\s*(?:10|190|200)\b|Instagram API (?:401|403)\b/i.test(
        error instanceof Error ? error.message : String(error)
      );
      const pauseReason = isRateLimitError(error)
        ? "rate_limited"
        : accessDenied
          ? "access_denied"
          : null;
      // Do not log raw provider errors or tokens, and never erase a saved success.
      const saved = await readJobRun(key, COMMENT_DATE).catch(() => null);
      if (saved?.status !== "success")
        await markJobRun(
          key,
          COMMENT_DATE,
          "failed",
          pauseReason ?? "Outcome uncertain; inspect the post. No automatic retry."
        );
      if (pauseReason) await pauseFirstComments(accountId, pauseReason, now);
      await recordServerError({
        level: "warn",
        route: "instagram/first-comment",
        message: `First comment for media ${source.mediaId}: ${pauseReason ?? "outcome uncertain"}. Publication claim retained.`,
      }).catch(() => {});
      return {
        state: pauseReason ? "paused" : "locked",
        mediaId: source.mediaId,
        reason: pauseReason,
      };
    }
  }
  return { state: "nothing-due" };
}

/** Adjust only this programme's first comment, checking the exact saved ID is
 * still readable. Unknown outcomes/read failures exclude comment-dependent
 * comparisons; they must never become an invented zero. */
export async function excludeAutomatedFirstComment(
  mediaId: string,
  accessToken: string,
  result: MediaMetricsResult
): Promise<MediaMetricsResult> {
  if (!validMetricCount(result.metrics.comments)) return result;
  let own: number | null = null;
  let readFailure: "rate_limited" | "access_denied" | null = null;
  try {
    const receipt = await readFirstCommentReceipt(mediaId);
    if (receipt.state === "not_attempted") own = 0;
    else if (receipt.state === "published") {
      if (await fetchCommentExists({ commentId: receipt.commentId, accessToken })) own = 1;
    }
  } catch (error) {
    // Preserve account-wide failures so the collector stops the remaining batch.
    if (isRateLimitError(error)) readFailure = "rate_limited";
    else if (
      /"code":\s*(?:10|190|200)\b|Instagram API (?:401|403)\b/i.test(
        error instanceof Error ? error.message : String(error)
      )
    )
      readFailure = "access_denied";
  }
  if (own === 0) return result;
  const subtract = (count: number | null) =>
    own !== null && validMetricCount(count) && count >= own ? count - own : null;
  const comments = subtract(result.metrics.comments);
  return {
    ...result,
    status: result.status === "complete" && comments === null ? "partial" : result.status,
    reason: readFailure ?? result.reason ?? (comments === null ? "incomplete_metrics" : null),
    metrics: {
      ...result.metrics,
      comments,
      totalInteractions: subtract(result.metrics.totalInteractions),
    },
  };
}
