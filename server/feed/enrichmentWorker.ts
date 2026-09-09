import { isEnrichedChannel } from "../../shared/const";
import { isDemoMode } from "../demo/store";
import { getFeedItemById } from "../db/feed";
import {
  ANGLE_FIELDS,
  claimFeedEnrichment,
  completeFeedEnrichment,
  failFeedEnrichment,
  sameEnrichmentSource,
  skipFeedEnrichment,
} from "../db/feedEnrichment";
import { generateDailyAngles, type DailyAngles } from "../prompts/dailyAngles";
import { invalidate } from "../core/cache";

const EMPTY: DailyAngles = {
  partnerTag: null,
  sayThis: null,
  whyItMatters: null,
  counterpoint: null,
};
let active: Promise<void> | undefined;

/** At most four calls per process, 40 jobs per pass. Overlapping processes are
 * fenced by individual database claims; a restart picks up expired work. */
export function drainFeedEnrichment(): Promise<void> {
  if (isDemoMode()) return Promise.resolve();
  if (active) return active;
  active = (async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, async () => {
        for (let i = 0; i < 10; i++) {
          const claim = await claimFeedEnrichment();
          if (!claim) return;
          try {
            const row = await getFeedItemById(claim.feedItemId);
            if (!row) {
              await skipFeedEnrichment(claim, "item_deleted");
              continue;
            }
            if (
              !claim.input ||
              !isEnrichedChannel(row.channel) ||
              !sameEnrichmentSource(claim.input, row)
            ) {
              await skipFeedEnrichment(claim, "source_changed");
              continue;
            }
            const angles = ANGLE_FIELDS.every((field) => row[field] != null)
              ? EMPTY
              : await generateDailyAngles(claim.input, {
                  strict: true,
                  signal: AbortSignal.timeout(120_000),
                });
            if (await completeFeedEnrichment(claim, angles, row)) invalidate("feed:");
          } catch {
            // Private error codes only; never log article text or model output.
            console.warn(
              `[feed-enrichment] item ${claim.feedItemId} attempt ${claim.attempts} failed`
            );
            await failFeedEnrichment(claim);
          }
        }
      })
    );
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
  })().finally(() => {
    active = undefined;
  });
  return active;
}

let started = false;
export function startFeedEnrichmentWorker() {
  if (started || isDemoMode()) return;
  started = true;
  const run = () =>
    void drainFeedEnrichment().catch(() =>
      console.warn("[feed-enrichment] queue unavailable; retrying on next poll")
    );
  run();
  setInterval(run, 60_000).unref();
  console.log("[feed-enrichment] recovery worker started");
}
