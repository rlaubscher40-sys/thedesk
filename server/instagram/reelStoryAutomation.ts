import { env } from "../core/env";
import { readReelPublicationHistory } from "../db/reelHistory";
import { readJobRun, claimJobRun, markJobRun } from "../db/jobRuns";
import { readReelStorySource, expireReelStoryPreparation } from "../db/reelStorySource";
import { recordServerError } from "../db/health";
import { REEL_PUBLICATION_FAMILIES } from "./reelCandidates";
import { instagramCooldownActive } from "./post";
import {
  createVideoStoryContainer,
  fetchPublishingLimit,
  isRateLimitError,
  publishContainer,
  waitForContainerReady,
} from "./api";
import { storeTempImage, removeTempImage } from "./tempStore";
import { renderStatReel } from "../video/statReel";
import { renderReelStory } from "../video/reelStory";
import { productionReelOptions } from "../video/reelProduction";
import { measureReelStory } from "./reelStoryMeasurement";

const GRACE_MS = 2 * 60 * 60_000;
const RETRY_MS = 15 * 60_000;
const MAX_ATTEMPTS = 2;

/** Run by the existing scheduler after its Reel check. No new timer or cron.
 * Only enrolled, durably confirmed Reels qualify; no historical backfill. */
export async function runReelStoryAutomation(now = new Date()) {
  if (
    !env.enableScheduler ||
    !env.scheduledApiKey ||
    !env.instagramAccessToken ||
    !env.instagramBusinessAccountId
  )
    return { state: "disabled" };
  if (instagramCooldownActive()) return { state: "cooldown" };
  const history = await readReelPublicationHistory(Object.keys(REEL_PUBLICATION_FAMILIES));
  const reel = history.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())[0];
  if (!reel) return { state: "no-confirmed-reel" };
  const age = now.getTime() - reel.publishedAt.getTime();
  const publishKey = `reel-story-publish-${reel.postId}`;
  const receipt = await readJobRun(publishKey, reel.date);
  if (receipt) {
    const storyId =
      receipt.status === "success"
        ? receipt.detail?.match(/^Published media (\d+)$/)?.[1]
        : undefined;
    if (storyId)
      await measureReelStory({
        reelId: reel.postId,
        storyId,
        date: reel.date,
        publishedAt: receipt.finishedAt ?? receipt.startedAt,
        accessToken: env.instagramAccessToken,
        now,
      });
    return { state: storyId ? "published" : "locked", reelId: reel.postId, storyId };
  }
  if (age < 0 || age > GRACE_MS) return { state: "outside-followup-window" };
  const source = await readReelStorySource(reel);
  if (!source) return { state: "not-enrolled", reelId: reel.postId };
  const prepareKey = `reel-story-prepare-${reel.postId}`;
  const attempt = await readJobRun(prepareKey, reel.date);
  if (attempt) {
    if (
      attempt.status === "success" ||
      attempt.attempts >= MAX_ATTEMPTS ||
      attempt.detail?.startsWith("PAUSED:")
    )
      return { state: "paused", reelId: reel.postId };
    const last = attempt.finishedAt ?? attempt.startedAt;
    if (now.getTime() - last.getTime() < RETRY_MS) return { state: "waiting", reelId: reel.postId };
    if (attempt.status === "running")
      await expireReelStoryPreparation(prepareKey, reel.date, new Date(now.getTime() - RETRY_MS));
  }
  const claimed = await claimJobRun(prepareKey, reel.date, MAX_ATTEMPTS);
  if (!claimed) return { state: "busy", reelId: reel.postId };
  const accessToken = env.instagramAccessToken,
    igUserId = env.instagramBusinessAccountId;
  let uuid: string | undefined;
  try {
    const quota = await fetchPublishingLimit({ accessToken, igUserId });
    if (quota.usage == null || quota.quota == null || quota.usage >= quota.quota)
      throw new Error("Story quota unavailable or exhausted.");
    const reelVideo = await renderStatReel(
      source.stat,
      "navy",
      productionReelOptions(source.script)
    );
    const story = await renderReelStory(reelVideo);
    uuid = storeTempImage(story.bytes, "video/mp4");
    const containerId = await createVideoStoryContainer({
      igUserId,
      accessToken,
      videoUrl: `${source.siteUrl.replace(/\/$/, "")}/instagram/temp/${uuid}.mp4`,
    });
    await waitForContainerReady({ containerId, accessToken, timeoutMs: 120_000 });
    // Claim exactly once immediately before the only non-idempotent call.
    if (!(await claimJobRun(publishKey, reel.date, 1)))
      return { state: "locked", reelId: reel.postId };
    let storyId: string;
    try {
      storyId = await publishContainer({ igUserId, accessToken, creationId: containerId });
      if (!/^\d+$/.test(storyId)) throw new Error("Missing Story media ID.");
    } catch {
      await markJobRun(
        publishKey,
        reel.date,
        "failed",
        `Outcome unknown; inspect Meta container ${containerId}. Never automatically retry publication.`
      );
      throw new Error(
        `Story publication uncertain; container ${containerId} locked for inspection.`
      );
    }
    await markJobRun(publishKey, reel.date, "success", `Published media ${storyId}`);
    // The separate permanent receipt, not a resolved API promise, establishes success.
    const saved = await readJobRun(publishKey, reel.date);
    if (saved?.status !== "success" || saved.detail !== `Published media ${storyId}`)
      throw new Error(
        `Story ${storyId} confirmed by Meta but durable receipt unavailable. Keep its lock.`
      );
    await markJobRun(
      prepareKey,
      reel.date,
      "success",
      JSON.stringify({ reelId: reel.postId, storyId, seconds: story.seconds })
    );
    console.log(
      `[reel-story] ${JSON.stringify({ state: "published", reelId: reel.postId, storyId, seconds: story.seconds })}`
    );
    return { state: "published", reelId: reel.postId, storyId };
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 450);
    const locked = await readJobRun(publishKey, reel.date).catch(() => ({ status: "unavailable" }));
    const paused = !!locked || isRateLimitError(error) || claimed >= MAX_ATTEMPTS;
    await markJobRun(prepareKey, reel.date, "failed", `${paused ? "PAUSED: " : ""}${message}`);
    console.error(
      `[reel-story] ${JSON.stringify({ state: paused ? "paused" : "retrying", reelId: reel.postId, reason: message })}`
    );
    await recordServerError({
      level: "warn",
      route: "instagram/reel-story",
      message: `Reel ${reel.postId} Story: ${message}`.slice(0, 512),
    }).catch(() => {});
    return { state: paused ? "paused" : "retrying", reelId: reel.postId };
  } finally {
    if (uuid) removeTempImage(uuid);
  }
}
