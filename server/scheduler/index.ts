/**
 * In-process scheduler with durable claims and bounded collection recovery.
 *
 * Design: a watermark + catch-up loop, not a fire-at-time-T timer. Every few
 * minutes (and shortly after boot) it asks, per job: "is it past this job's
 * time in Sydney today, and hasn't today's run been claimed?" — and if so,
 * claims it (atomic, via job_runs) and runs it. That makes it self-healing: a
 * redeploy, a brief outage, or a missed minute can't drop a day; the job runs
 * as soon as the server is up and notices it's overdue. The watermark also
 * bounds attempts per job/date across replicas. Repeatable data collectors
 * use fenced, expiring claims; publication jobs retain their own protections.
 *
 * Jobs are driven against the server's own loopback address:
 *   - daily-feed points its ingest at 127.0.0.1 for enrichment.
 *   - metric and archive collectors read and persist directly, without AI.
 *   - the rest POST the existing scheduled endpoints on loopback.
 *
 * Gated by env.enableScheduler (ENABLE_SCHEDULER=true). Off by default so it
 * can be rolled out deliberately alongside retiring the GitHub crons.
 */
import { env } from "../core/env";
import { runReelStoryAutomation } from "../instagram/reelStoryAutomation";
import { isDemoMode } from "../demo/store";
import { sendAdminAlertEmail } from "../core/mailer";
import { recordServerError } from "../db/health";
import { claimJobRun, markJobRun } from "../db/jobRuns";
import { runDailyFeedIngest } from "../../scripts/ingest/dailyFeed";
import { runReelAutomation, REEL_MAX_ATTEMPTS } from "../instagram/reelAutomation";

import { collectPropertyEvidence } from "../evidence/collect";
import { collectLocalData } from "../localData/collect";
import {
  REVIEWED_SA_JOB,
  REVIEWED_VIC_JOB,
  reviewedVicReleasePending,
  importReviewedVicRelease,
  reviewedSaReleasePending,
  importReviewedSaRelease,
} from "../localData/reviewedRelease";
import { readLocalDataHealth } from "../db/localData";
import { pausedLocalSourceJobs } from "../../shared/localSourceAccess";
import { LocalSourceAccessPaused } from "../localData/access";
import { LOCAL_SOURCE_KEYS } from "../../shared/localData";
import { recoverMissingMetrics, runScheduledMetricRefresh } from "../metrics/recovery";
import {
  claimCollectionRun,
  finishCollectionRun,
  isCollectionJob,
  runCollectionAttempt,
} from "../db/collectionRuns";
import {
  sydneySocialClock as sydneyClock,
  INSTAGRAM_FEED_SLOTS,
  type SocialClock as SchedulerClock,
} from "../../shared/instagramSchedule";

const TICK_MINUTES = 5;
const BOOT_DELAY_MS = 15_000;
/**
 * How late a job may still run. Catch-up after a short outage is the whole
 * point — but a job that's hours overdue should be skipped, not fired
 * retroactively, or enabling the scheduler at (say) 2pm would blast out a
 * stale "morning briefing". 5h covers a realistic restart window while never
 * posting yesterday's-feeling content in the afternoon.
 */
const GRACE_MINUTES = 5 * 60;

export { sydneySocialClock as sydneyClock } from "../../shared/instagramSchedule";
export type { SocialClock as SchedulerClock } from "../../shared/instagramSchedule";

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

type Job = {
  /** Fixed durable claim date for one-time rollout jobs. */
  claimDate?: string;
  graceMinutes?: number;
  key: string;
  /** Sydney "HH:MM" — the earliest the job may run that day. */
  at: string;
  /** Restrict to these days (0=Sun…6=Sat). Omitted = every day. */
  dow?: number[];
  /**
   * Restrict to these days of the month (1-31). Omitted = every day.
   *
   * Combines with `dow` as AND, not OR, though nothing currently sets both.
   * Note that a job pinned to 29, 30 or 31 will not run in months that lack
   * the date; the monthly review uses 1 for that reason.
   */
  dom?: number[];
  excludeDom?: number[];
  /**
   * Max attempts per day. The Instagram posting jobs sit at 2 rather than the
   * ingest default of 3: the risk they used to guard against with 1 — a
   * "failed" post that actually published (a timeout after the Graph API
   * accepted it) turning into a duplicate — is now handled properly on the
   * route, which checks the account's newest media before re-posting and
   * records the existing post instead. One retry buys back the case that
   * matters: a transient Graph API 500 no longer costs the whole day's post.
   */
  maxAttempts?: number;
  run: (baseUrl: string, apiKey: string, attempt: number) => Promise<void>;
};

/**
 * Pure predicate (exported for tests): is the job due as of `clock`? True only
 * within the grace window after its time, so a long-overdue job is skipped
 * rather than fired retroactively.
 */
export function isJobDue(job: Job, clock: SchedulerClock): boolean {
  if (job.dow && !job.dow.includes(clock.dow)) return false;
  if (job.dom && !job.dom.includes(clock.dom)) return false;
  if (job.excludeDom?.includes(clock.dom)) return false;
  const at = hhmmToMinutes(job.at);
  return (
    clock.minutes >= at &&
    clock.minutes <= at + (job.graceMinutes ?? GRACE_MINUTES)
  );
}

/**
 * POST a scheduled endpoint on loopback. The attempt number rides along in the
 * body so a posting route can tell a first run from a retry — a retry checks
 * the account for a post the previous attempt may have published before it
 * failed, instead of blindly posting again.
 */
async function postLocal(
  baseUrl: string,
  apiKey: string,
  path: string,
  attempt = 1,
): Promise<void> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-scheduled-key": apiKey },
    body: JSON.stringify({ attempt }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`POST ${path} → ${res.status} ${body.slice(0, 200)}`);
  }
}

/**
 * Job table. Times mirror the GitHub cron intents but in real Sydney time
 * (DST-correct). daily-metrics leads daily-feed so the IG cover's metric strip
 * is fresh; the IG posts follow the feed.
 */
export const EVIDENCE_JOBS: Job[] = Array.from({ length: 24 }, (_, hour) => ({
  key: `property-evidence-${String(hour).padStart(2, "0")}`,
  at: `${String(hour).padStart(2, "0")}:00`,
  graceMinutes: 59,
  maxAttempts: 2,
  run: async () => {
    await collectPropertyEvidence();
  },
}));

export const METRIC_RECOVERY_JOBS: Job[] = [0, 4, 8, 12, 16, 20].map(
  (hour) => ({
    key: `official-metrics-recovery-${String(hour).padStart(2, "0")}`,
    at: `${String(hour).padStart(2, "0")}:00`,
    graceMinutes: 239,
    maxAttempts: 3,
    run: async () => {
      await recoverMissingMetrics();
    },
  }),
);

const JOBS: Job[] = [
  {
    key: REVIEWED_VIC_JOB,
    at: "00:00",
    graceMinutes: 24 * 60 - 1,
    maxAttempts: 2,
    run: importReviewedVicRelease,
  },
  {
    key: REVIEWED_SA_JOB,
    at: "00:00",
    graceMinutes: 24 * 60 - 1,
    maxAttempts: 2,
    run: importReviewedSaRelease,
  },
  ...LOCAL_SOURCE_KEYS.map((source, index) => ({
    key: `local-data-${source}`,
    at: `00:${15 + index * 5}`,
    graceMinutes: 23 * 60,
    maxAttempts: source === "vic-bond-rents" ? 1 : 2,
    run: async () => collectLocalData(source),
  })),
  ...METRIC_RECOVERY_JOBS,
  ...["12:03", "18:03"].map((at) => ({
    key: `official-metrics-${at.slice(0, 2)}`,
    at,
    graceMinutes: 120,
    run: () => runScheduledMetricRefresh(),
  })),
  { key: "daily-metrics", at: "06:33", run: () => runScheduledMetricRefresh() },
  { key: "editorial-pipeline-v4", at: "00:00", graceMinutes: 24 * 60, claimDate: "2026-09-10", run: (b, k) => runDailyFeedIngest(b, k) },
  { key: "daily-feed", at: "06:43", run: (b, k) => runDailyFeedIngest(b, k) },
  ...["12:43", "18:43"].map(at => ({ key: `daily-feed-update-${at.slice(0, 2)}`, at, run: (b: string, k: string) => runDailyFeedIngest(b, k) })),
  {
    key: "instagram-daily",
    ...INSTAGRAM_FEED_SLOTS.daily,
    maxAttempts: 2,
    run: (b, k, a) => postLocal(b, k, "/api/ingest/instagram-daily", a),
  },
  {
    key: "instagram-insights",
    at: "07:17",
    run: (b, k) => postLocal(b, k, "/api/ingest/instagram-insights"),
  },
  // General-news coverage remains manual. Property formats use a trial rhythm;
  // posting frequency alone does not establish an effect on reach.
  {
    key: "instagram-stat",
    ...INSTAGRAM_FEED_SLOTS.stat,
    maxAttempts: 2,
    run: (b, k, a) => postLocal(b, k, "/api/ingest/instagram-stat", a),
  },
  // Verified Reels use content-driven delivery below. An old daily "success"
  // (including an honest skip) must not suppress newly available evidence.
  // The 1st of the month, covering the month that just finished. Sits after the
  // morning briefing so the two do not publish within minutes of each other.
  {
    key: "instagram-monthly",
    ...INSTAGRAM_FEED_SLOTS.monthly,
    maxAttempts: 2,
    run: (b, k, a) => postLocal(b, k, "/api/ingest/instagram-monthly", a),
  },
  {
    key: "weekly-edition",
    at: "07:17",
    dow: [0],
    run: (b, k) => postLocal(b, k, "/api/ingest/synthesize-edition"),
  },
  {
    key: "instagram-weekly",
    ...INSTAGRAM_FEED_SLOTS.weekly,
    maxAttempts: 2,
    run: (b, k, a) => postLocal(b, k, "/api/ingest/instagram-weekly", a),
  },
  ...EVIDENCE_JOBS,
];

/**
 * Email the admin when a job has used up its attempts for the day. Best-effort
 * and self-contained: a mailer hiccup must never crash the tick or mask the
 * original failure (which is already logged + recorded above). Fires at most
 * once per job per day because a terminal failure leaves attempts == maxAttempts,
 * so claimJobRun won't re-claim it.
 *
 * The attempt counts are passed through so the email can say what actually
 * happened — "failed on its only attempt" reads very differently from "failed
 * twice", and the old copy claimed exhausted retries either way.
 */
async function alertTerminalFailure(
  jobKey: string,
  clock: SchedulerClock,
  detail: string,
  attempt: number,
  maxAttempts: number,
): Promise<void> {
  const to = env.adminAlertEmail;
  if (!to) return;
  try {
    const when = `${clock.dateISO} ${String(Math.floor(clock.minutes / 60)).padStart(2, "0")}:${String(clock.minutes % 60).padStart(2, "0")}`;
    await sendAdminAlertEmail({
      to,
      subject: `⚠ The Desk scheduler: "${jobKey}" failed`,
      jobKey,
      detail,
      when,
      attempt,
      maxAttempts,
    });
  } catch (err) {
    console.warn(
      `[scheduler] alert email for ${jobKey} failed:`,
      (err as Error).message,
    );
  }
}

let ticking = false;

async function tick(baseUrl: string, apiKey: string): Promise<void> {
  if (ticking) return; // a slow run must not overlap the next interval
  ticking = true;
  try {
    const pausedLocalJobs = pausedLocalSourceJobs(
      await readLocalDataHealth().catch(() => []),
    );
    for (const job of JOBS) {
      if (job.key === REVIEWED_VIC_JOB && !(await reviewedVicReleasePending().catch(err => {
        console.warn("[scheduler] cannot check reviewed VIC import:", (err as Error).message);
        return false;
      }))) continue;
      if (
        job.key === REVIEWED_SA_JOB &&
        !(await reviewedSaReleasePending().catch((err) => {
          console.warn(
            "[scheduler] cannot check reviewed SA import:",
            (err as Error).message,
          );
          return false;
        }))
      )
        continue;
      if (pausedLocalJobs.has(job.key)) continue;
      const clock = sydneyClock();
      if (!isJobDue(job, clock)) continue;
      const maxAttempts = job.maxAttempts ?? 3;
      const collection = isCollectionJob(job.key);
      const lease = collection
        ? await claimCollectionRun(job.key, clock.dateISO, maxAttempts).catch(
            (err) => {
              console.error(
                `[scheduler] cannot claim ${job.key}:`,
                (err as Error).message,
              );
              return null;
            },
          )
        : null;
      const attempt = collection
        ? (lease?.attempt ?? 0)
        : await claimJobRun(job.key, job.claimDate ?? clock.dateISO, maxAttempts);
      if (!attempt) continue;
      console.log(
        `[scheduler] running ${job.key} (${clock.dateISO}, attempt ${attempt}/${maxAttempts})`,
      );
      try {
        if (lease) {
          await runCollectionAttempt(lease, () =>
            job.run(baseUrl, apiKey, attempt),
          );
          if (!(await finishCollectionRun(lease, "success"))) continue;
        } else {
          await job.run(baseUrl, apiKey, attempt);
          await markJobRun(job.key, job.claimDate ?? clock.dateISO, "success");
        }
        console.log(`[scheduler] ${job.key} ✓`);
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        const accessPaused = err instanceof LocalSourceAccessPaused;
        console.error(
          `[scheduler] ${job.key} ${accessPaused ? "paused" : "failed"}:`,
          msg,
        );
        if (lease) {
          const finished = await finishCollectionRun(
            lease,
            "failed",
            msg,
          ).catch(() => false);
          if (!finished) continue;
        } else {
          await markJobRun(job.key, job.claimDate ?? clock.dateISO, "failed", msg.slice(0, 480));
        }
        await recordServerError({
          level: "error",
          message: `[scheduler] ${job.key} failed: ${msg}`.slice(0, 512),
          route: "scheduler",
        }).catch(() => {});
        // Terminal failure: this was the last attempt the job gets today, so it
        // won't self-heal on a later tick. Alert loudly (once) rather than
        // letting it sink into the error log — the silent weekly-post failure
        // is exactly what this guards against.
        if (!accessPaused && attempt >= maxAttempts) {
          await alertTerminalFailure(job.key, clock, msg, attempt, maxAttempts);
        }
      }
    }
    // The approved comparison is delivered as soon as evidence and rendering
    // are ready, independent of weekday windows and old calendar watermarks.
    // Keep it after other grid jobs so cover alternation sees their records.
    await runReelAutomation({
      post: async (evidenceHash) => {
        const response = await fetch(`${baseUrl}/api/ingest/instagram-reel`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-scheduled-key": apiKey,
          },
          body: JSON.stringify({ evidenceHash }),
          signal: AbortSignal.timeout(290_000),
        });
        const body = await response.text();
        if (!response.ok) {
          let detail = body.slice(0, 450);
          try {
            const parsed = JSON.parse(body);
            detail = parsed.message ?? parsed.detail ?? parsed.error ?? detail;
          } catch {
            /* Non-JSON proxy errors retain their bounded text. */
          }
          throw new Error(
            `Reel delivery ${response.status}: ${String(detail).slice(0, 450)}`,
          );
        }
        return JSON.parse(body);
      },
      alert: (detail, attempt) =>
        alertTerminalFailure(
          "instagram-reel",
          sydneyClock(),
          detail,
          attempt,
          REEL_MAX_ATTEMPTS,
        ),
    }).catch(async (err) => {
      console.error(
        "[scheduler] Reel delivery check failed:",
        (err as Error).message,
      );
      await recordServerError({
        level: "error",
        route: "scheduler/reel",
        message: `Reel delivery check failed: ${(err as Error).message}`.slice(
          0,
          512,
        ),
      }).catch(() => {});
    });
    // Story delivery has its own claims and failure handling. It also runs
    // when today's Reel is already published, so preparation survives a restart.
    await runReelStoryAutomation()
      .then((result) => {
        console.log(`[reel-story-plan] ${JSON.stringify(result)}`);
      })
      .catch(async (error) => {
        console.error("[scheduler] Reel Story check failed:", (error as Error).message);
        await recordServerError({
          level: "warn",
          route: "scheduler/reel-story",
          message: `Reel Story check failed: ${(error as Error).message}`.slice(0, 512),
        }).catch(() => {});
      });
  } finally {
    ticking = false;
  }
}

let started = false;

/**
 * Start the scheduler against the server's loopback address. No-ops in demo
 * mode, when ENABLE_SCHEDULER isn't true, or without a SCHEDULED_API_KEY (the
 * self-calls need it to authenticate). Safe to call once after `listen`.
 */
export function startScheduler(opts: { port: number }): void {
  if (started) return;
  if (isDemoMode()) return;
  if (!env.enableScheduler) {
    console.log("[scheduler] disabled (set ENABLE_SCHEDULER=true to enable)");
    return;
  }
  if (!env.scheduledApiKey) {
    console.warn(
      "[scheduler] SCHEDULED_API_KEY not set — cannot authenticate self-calls; not starting",
    );
    return;
  }
  started = true;
  const baseUrl = `http://127.0.0.1:${opts.port}`;
  const apiKey = env.scheduledApiKey;
  console.log(
    `[scheduler] enabled — ${JOBS.length} jobs, polling every ${TICK_MINUTES}m (Sydney time)`,
  );
  const fire = () => void tick(baseUrl, apiKey);
  setTimeout(fire, BOOT_DELAY_MS); // catch-up shortly after boot
  const handle = setInterval(fire, TICK_MINUTES * 60_000);
  // Don't keep the event loop alive solely for the timer.
  handle.unref?.();
}
