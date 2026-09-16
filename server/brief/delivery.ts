import { dailyBriefWindow } from "../../shared/briefSchedule";
import { sydneySocialClock } from "../../shared/instagramSchedule";
import { isDemoMode } from "../demo/store";
import * as queue from "../db/dailyBrief";
import { buildDailyBriefEmail, editionUnsubscribeUrl, send } from "../core/mailer";

let active: Promise<void> | undefined;
let expiryCheckpoint = "";
let recovery = {
  lastPollAt: null as string | null,
  lastCompletedPollAt: null as string | null,
  lastFailureAt: null as string | null,
  consecutiveFailures: 0,
  reason: null as string | null,
};
export const dailyBriefRecoveryStatus = () => ({ ...recovery });
export function deliverDailyBrief(now: () => Date = () => new Date()): Promise<void> {
  if (isDemoMode() || !process.env.RESEND_API_KEY) return Promise.resolve();
  if (active) return active;
  active = (async () => {
    const startedAt = now();
    recovery.lastPollAt = startedAt.toISOString();
    const clock = sydneySocialClock(startedAt);
    const expiry = `${clock.dateISO}:${clock.minutes >= 720 ? "closed" : "open"}`;
    if (expiryCheckpoint !== expiry) {
      await queue.expireDailyBriefs(clock.dateISO, clock.minutes >= 720);
      expiryCheckpoint = expiry;
    }
    const date = dailyBriefWindow(now());
    if (!date) return;
    let items = await queue.readBriefBatch(date);
    if (!items) {
      const ready = await queue.readReadyBriefStories(date);
      if (!ready) return;
      items = await queue.freezeBriefBatch(date, ready);
    }
    const origin = (
      process.env.SITE_URL ??
      process.env.VITE_SITE_URL ??
      "https://thedesk.au"
    ).replace(/\/+$/, "");
    for (const sub of await queue.dailyBriefCandidates(date)) {
      if (dailyBriefWindow(now()) !== date) break;
      // A saved batch can outlive a correction or takedown. Do not distribute
      // its frozen copy after one of its source stories has been held/deleted.
      if (!(await queue.briefStoriesStillPublic(items.map((item) => item.id)))) break;
      const payload = buildDailyBriefEmail({
        to: sub.email,
        name: sub.name,
        items,
        feedDate: date,
        siteUrl: origin,
        unsubscribeUrl: editionUnsubscribeUrl(sub.email, origin),
      });
      const claim = await queue.claimDailyBrief(date, sub.id, payload);
      if (!claim) continue;
      // Check consent and ownership immediately before contacting the provider.
      if (!(await queue.briefRecipientEligible(claim))) {
        await queue.finishDailyBrief(claim, "skipped");
        continue;
      }
      if (dailyBriefWindow(now()) !== date) break;
      const result = await send(claim.payload, {
        idempotencyKey: queue.dailyBriefIdempotencyKey(date, sub.id),
      });
      await queue.finishDailyBrief(
        claim,
        result.delivered ? "accepted" : "retry",
        result.delivered ? result.id : undefined
      );
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  })()
    .then(() => {
      recovery = {
        ...recovery,
        lastCompletedPollAt: now().toISOString(),
        consecutiveFailures: 0,
        reason: null,
      };
    })
    .catch((error: unknown) => {
      const code =
        typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      const reason = [
        "ECONNREFUSED",
        "ETIMEDOUT",
        "ER_LOCK_DEADLOCK",
        "ER_LOCK_WAIT_TIMEOUT",
        "ER_NO_SUCH_TABLE",
        "ER_BAD_FIELD_ERROR",
      ].includes(code)
        ? code
        : "delivery_or_storage_unavailable";
      recovery = {
        ...recovery,
        lastFailureAt: now().toISOString(),
        consecutiveFailures: recovery.consecutiveFailures + 1,
        reason,
      };
      // Never log provider payloads, recipient addresses or unrestricted DB errors.
      if (recovery.consecutiveFailures === 1 || recovery.consecutiveFailures % 5 === 0)
        console.warn(`[daily-brief] recovery ${JSON.stringify(recovery)}`);
      throw error;
    })
    .finally(() => {
      active = undefined;
    });
  return active;
}
let started = false;
export function startDailyBriefDelivery() {
  if (started || isDemoMode()) return;
  started = true;
  const run = () => void deliverDailyBrief().catch(() => {}); // Classified privately above; next bounded poll retries.
  run();
  setInterval(run, 60_000).unref();
  console.log("[daily-brief] delivery recovery started; weekdays 7am–noon Sydney");
}
