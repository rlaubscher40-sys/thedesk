import { inReelWindow, REEL_WINDOW } from "../../shared/instagramSchedule";
import { env } from "../core/env";
import { claimJobRun, markJobRun, readJobRun, expireReelDelivery } from "../db/jobRuns";
import { getVerifiedReelCandidates, chooseReelCandidate } from "./reelCandidates";
import { reelPublicationRecord } from "./reelStatus";
import { isRateLimitError } from "./api";
import { logReelPlan } from "./reelPlanSummary";

export const REEL_POLL_MINUTES = 5;
export const REEL_RETRY_MINUTES = 15;
export const REEL_STALE_MINUTES = 15;
export const REEL_MAX_ATTEMPTS = 2;
export const REEL_SCHEDULE = `Six evidence-gated topics: city comparisons, eight-capital rents, Sydney reads and a dated national housing balance; at most one automatic Reel per Sydney day, ${REEL_WINDOW.label}, checked every 5 minutes. Monthly and annual-report evidence, not six guaranteed posts`;
export const REEL_DELIVERY_KEY = "instagram-reel-delivery-programme-v1";

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
  const candidates = await getVerifiedReelCandidates(now);
  const date = sydneyDate(now);
  let candidate = candidates[0] ?? null;
  if (!candidate) return { state: "no-evidence" as const, candidate, date };
  const records = await Promise.all(
    candidates.map((item) => reelPublicationRecord(item.publication))
  );
  // Inspect every topic before advancing. A published topic may make way for
  // another, but an uncertain result or unavailable DB pauses the programme.
  const blocked = records.findIndex(
    (record) => record.state === "locked" || record.state === "unavailable"
  );
  if (blocked >= 0)
    return {
      state: records[blocked]!.state as "locked" | "unavailable",
      candidate: candidates[blocked]!,
      date,
    };
  const available = chooseReelCandidate(candidates, records);
  if (available < 0)
    return { state: "published" as const, candidate, date, postId: records[0]!.postId };
  candidate = candidates[available]!;
  // Also recover the daily cap from the permanent publication record if the
  // delivery response or the best-effort day watermark was lost after posting.
  if (
    records.some(
      (record) =>
        "publishedAt" in record && record.publishedAt && sydneyDate(record.publishedAt) === date
    )
  )
    return { state: "daily-limit" as const, candidate, date };
  if (!inReelWindow(now)) return { state: "scheduled" as const, candidate, date };
  const key = REEL_DELIVERY_KEY;
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
    // This shared daily slot was consumed by a confirmed topic. A different
    // eligible topic waits until tomorrow instead of posting five minutes later.
    return { state: "daily-limit" as const, candidate, date, attempt };
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
  logReelPlan(plan, true, true, options.now);
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
