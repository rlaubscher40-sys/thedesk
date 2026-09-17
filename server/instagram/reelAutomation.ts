import {
  documentaryPublicationGuard,
  logDocumentaryReleaseReadiness,
} from "./documentaryPublicationGuard";
import { inReelWindow, REEL_WINDOW } from "../../shared/instagramSchedule";
import { env } from "../core/env";
import { claimJobRun, markJobRun, readJobRun, expireReelDelivery } from "../db/jobRuns";
import {
  getVerifiedReelCandidates,
  chooseReelCandidate,
  REEL_PUBLICATION_FAMILIES,
} from "./reelCandidates";
import { reelPublicationRecord } from "./reelStatus";
import { isRateLimitError } from "./api";
import { logReelPlan } from "./reelPlanSummary";
import { readReelPublicationHistory } from "../db/reelHistory";
import { DOCUMENTARY_EPISODES, RETIRED_DOCUMENTARY_PUBLICATIONS } from "./documentaryEpisodes";
import { documentaryCandidate } from "./verifiedDocumentaryReel";
const REEL_RETRY_MINUTES = 15;
const REEL_STALE_MINUTES = 15;
export const REEL_MAX_ATTEMPTS = 2;
export const REEL_SCHEDULE = `Wednesday: The Deal. Sunday: Property Empires. Reviewed documentary episodes take that day's slot at 6:30pm Sydney, within ${REEL_WINDOW.label}. Four finished episodes are required before launch. Fifteen data topics fill other days or an empty documentary slot. At most one automatic Reel per Sydney day, checked every 5 minutes; daily posts are not guaranteed`;
const REEL_DELIVERY_KEY = "instagram-reel-delivery-programme-v1";

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
  let history;
  try {
    history = await readReelPublicationHistory(Object.keys(REEL_PUBLICATION_FAMILIES));
  } catch {
    return {
      state: "unavailable" as const,
      candidate: null,
      date: sydneyDate(now),
      lastConfirmedPublication: null,
    };
  }
  const latest = [...history].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime() || a.key.localeCompare(b.key)
  )[0];
  // History is independent of today's evidence and selection. Keep the receipt
  // visible after rotation, source withdrawal, and restarts, even while blocked.
  const lastConfirmedPublication = latest
    ? {
        publication: { key: latest.key, date: latest.date },
        family: REEL_PUBLICATION_FAMILIES[latest.key]!,
        postId: latest.postId,
        publishedAt: latest.publishedAt,
      }
    : null;
  return { ...(await readReelSelection(now, history)), lastConfirmedPublication };
}

async function readReelSelection(
  now: Date,
  history: Awaited<ReturnType<typeof readReelPublicationHistory>>
) {
  const offered = await getVerifiedReelCandidates(now);
  const candidates = [];
  for (const item of offered) {
    if ("documentary" in item.stat && item.stat.documentary) {
      const guard = await documentaryPublicationGuard(item.stat.documentary.id, now);
      if (!guard.ready) continue; // Retain the ordinary programme's existing fallback.
    }
    candidates.push(item);
  }
  const date = sydneyDate(now);
  // A dated slot expiring must not hide an uncertain publication. Keep reading
  // permanent documentary receipts after their day, even if review is withdrawn.
  const documentaries = [
    ...DOCUMENTARY_EPISODES.map((episode) => ({
      ...documentaryCandidate(episode),
      topic: episode.series,
      family: episode.series === "The Deal" ? "documentary-deal" : "documentary-empires",
    })),
    ...RETIRED_DOCUMENTARY_PUBLICATIONS.filter((episode) => episode.releaseDate <= date),
  ];
  const documentaryRecords = await Promise.all(
    documentaries.map((item) => reelPublicationRecord(item.publication))
  );
  const documentaryBlock = documentaryRecords.findIndex(
    (r) => r.state === "locked" || r.state === "unavailable"
  );
  if (documentaryBlock >= 0) {
    const blocked = documentaries[documentaryBlock]!;
    return {
      state: documentaryRecords[documentaryBlock]!.state as "locked" | "unavailable",
      // Retired receipts are visible blockers, never renderable candidates.
      candidate: "stat" in blocked ? blocked : null,
      blockedPublication: blocked.publication,
      date,
    };
  }
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
  const available = chooseReelCandidate(
    candidates,
    records,
    history.flatMap((item) => {
      const family = REEL_PUBLICATION_FAMILIES[item.key];
      return family ? [{ family, publishedAt: item.publishedAt }] : [];
    })
  );
  if (available < 0) return { state: "exhausted" as const, candidate: null, date };
  candidate = candidates[available]!;
  // Also recover the daily cap from the permanent publication record if the
  // delivery response or the best-effort day watermark was lost after posting.
  if (
    history.some((record) => sydneyDate(record.publishedAt) === date) ||
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
  await logDocumentaryReleaseReadiness(options.now).catch((error) =>
    console.warn("[instagram] documentary readiness unavailable:", String(error))
  );
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
