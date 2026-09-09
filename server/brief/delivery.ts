import { dailyBriefWindow } from "../../shared/briefSchedule";
import { sydneySocialClock } from "../../shared/instagramSchedule";
import { isDemoMode } from "../demo/store";
import * as queue from "../db/dailyBrief";
import { buildDailyBriefEmail, editionUnsubscribeUrl, send } from "../core/mailer";

let active: Promise<void> | undefined;
export function deliverDailyBrief(now: () => Date = () => new Date()): Promise<void> {
  if (isDemoMode() || !process.env.RESEND_API_KEY) return Promise.resolve();
  if (active) return active;
  active = (async () => {
    const clock = sydneySocialClock(now());
    await queue.expireDailyBriefs(clock.dateISO, clock.minutes >= 720);
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
  })().finally(() => {
    active = undefined;
  });
  return active;
}
let started = false;
export function startDailyBriefDelivery() {
  if (started || isDemoMode()) return;
  started = true;
  const run = () =>
    void deliverDailyBrief().catch(() => console.warn("[daily-brief] recovery poll unavailable"));
  run();
  setInterval(run, 60_000).unref();
  console.log("[daily-brief] delivery recovery started; weekdays 7am–noon Sydney");
}
