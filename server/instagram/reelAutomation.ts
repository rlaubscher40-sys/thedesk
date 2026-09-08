import { env } from "../core/env";
import { claimJobRun, markJobRun, readJobRun, expireReelDelivery } from "../db/jobRuns";
import { getCityRents } from "../markets/absRents";
import { verifiedRentReel } from "./verifiedReel";
import { reelPublicationRecord } from "./reelStatus";
import { isRateLimitError } from "./api";

export const REEL_POLL_MINUTES = 5;
export const REEL_RETRY_MINUTES = 15;
export const REEL_STALE_MINUTES = 15;
export const REEL_MAX_ATTEMPTS = 2;
export const REEL_SCHEDULE = "New verified monthly comparison, checked every 5 minutes";

function deliveryKey(date: string) {
  // A corrected speech runtime gets its own bounded preparation attempts.
  // The permanent evidence publication key is deliberately NOT versioned here:
  // a confirmed or uncertain Meta publish still prevents every new attempt.
  return `instagram-reel-delivery-speech2-${date}`;
}
function sydneyDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Content identity owns publication; a calendar watermark must not consume it. */
export async function readReelAutomation(now = new Date()) {
  const candidate = verifiedRentReel(await getCityRents(), now);
  const date = sydneyDate(now);
  if (!candidate) return { state: "no-evidence" as const, candidate, date };
  const publication = await reelPublicationRecord(candidate.publication);
  if (publication.state !== "available")
    return { state: publication.state, candidate, date, postId: publication.postId };
  const key = deliveryKey(candidate.publication.date);
  let attempt;
  try {
    attempt = await readJobRun(key, date);
  } catch {
    return { state: "unavailable" as const, candidate, date };
  }
  if (attempt?.status === "running") {
    const expired = attempt.startedAt.getTime() < now.getTime() - REEL_STALE_MINUTES * 60_000;
    if (!expired) return { state: "running" as const, candidate, date, attempt };
    if (attempt.attempts >= REEL_MAX_ATTEMPTS)
      return { state: "paused" as const, candidate, date, attempt };
    return { state: "ready" as const, candidate, date, key, attempt, expired: true };
  }
  if (attempt?.status === "success")
    // A response alone is not proof. This unexpected inconsistency needs inspection.
    return { state: "locked" as const, candidate, date, attempt };
  if (attempt?.status === "failed") {
    if (attempt.attempts >= REEL_MAX_ATTEMPTS || attempt.detail?.startsWith("PAUSED:"))
      return { state: "paused" as const, candidate, date, attempt };
    const retryAt = new Date(
      (attempt.finishedAt ?? attempt.startedAt).getTime() + REEL_RETRY_MINUTES * 60_000
    );
    if (now < retryAt) return { state: "retrying" as const, candidate, date, attempt, retryAt };
  }
  return { state: "ready" as const, candidate, date, key, attempt };
}

export type ReelAttemptResult = {
  success?: boolean;
  skipped?: boolean;
  postId?: string;
  reason?: string;
};

/**
 * Called by the existing server scheduler, including after boot. No browser,
 * preview, confirmation dialog, new credential, or third-party cron required.
 * Delivery claims bound expensive retries; the existing publication claim still
 * guards the only non-idempotent Meta call across manual runs and replicas.
 */
export async function runReelAutomation(options: {
  post: (evidenceHash: string) => Promise<ReelAttemptResult>;
  alert: (detail: string, attempt: number) => Promise<void>;
  now?: Date;
}) {
  if (
    !env.enableScheduler ||
    !env.scheduledApiKey ||
    !env.instagramAccessToken ||
    !env.instagramBusinessAccountId
  )
    return { state: "disabled" as const };
  const plan = await readReelAutomation(options.now);
  if (plan.state !== "ready") return { state: plan.state };
  if ("expired" in plan && plan.expired)
    await expireReelDelivery(
      plan.key,
      plan.date,
      new Date((options.now ?? new Date()).getTime() - REEL_STALE_MINUTES * 60_000)
    );
  const attempt = await claimJobRun(plan.key, plan.date, REEL_MAX_ATTEMPTS);
  if (!attempt) return { state: "busy" as const };
  try {
    const result = await options.post(plan.candidate.evidenceHash);
    const record = await reelPublicationRecord(plan.candidate.publication);
    // A skip/HTTP 200 is never labelled as a published Reel. Confirm the durable
    // record, including when another runner won the publication race.
    if (record.state !== "published" || !record.postId)
      throw new Error(result.reason ?? "The Reel run returned without a confirmed publication.");
    await markJobRun(plan.key, plan.date, "success", `Published media ${record.postId}`);
    return { state: "published" as const, postId: record.postId };
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 450);
    // An integrity/rate block is not a transient failure to hammer again today.
    const paused = isRateLimitError(error);
    await markJobRun(plan.key, plan.date, "failed", `${paused ? "PAUSED: " : ""}${message}`);
    const record = await reelPublicationRecord(plan.candidate.publication);
    if (record.state === "published") {
      await markJobRun(plan.key, plan.date, "success", `Published media ${record.postId}`);
      return { state: "published" as const, postId: record.postId };
    }
    const terminal = paused || attempt >= REEL_MAX_ATTEMPTS || record.state === "locked";
    if (terminal) await options.alert(message, attempt).catch(() => {});
    console.error(`[instagram] automatic Reel attempt ${attempt}: ${message}`);
    return { state: terminal ? ("blocked" as const) : ("retrying" as const) };
  }
}
