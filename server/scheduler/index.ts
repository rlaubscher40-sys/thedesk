/**
 * In-process scheduler — the fail-proof replacement for GitHub Actions cron.
 *
 * Design: a watermark + catch-up loop, not a fire-at-time-T timer. Every few
 * minutes (and shortly after boot) it asks, per job: "is it past this job's
 * time in Sydney today, and hasn't today's run been claimed?" — and if so,
 * claims it (atomic, via job_runs) and runs it. That makes it self-healing: a
 * redeploy, a brief outage, or a missed minute can't drop a day; the job runs
 * as soon as the server is up and notices it's overdue. The watermark also
 * means at most one run per day even across replicas or overlapping ticks.
 *
 * Jobs are driven against the server's own loopback address:
 *   - daily-feed / daily-metrics import the ingest's pure run-function and
 *     point it at 127.0.0.1, so the RSS fetch + enrich happens in-process.
 *   - the rest POST the existing scheduled endpoints on loopback.
 *
 * Gated by env.enableScheduler (ENABLE_SCHEDULER=true). Off by default so it
 * can be rolled out deliberately alongside retiring the GitHub crons.
 */
import { env } from "../core/env";
import { isDemoMode } from "../demo/store";
import { recordServerError } from "../db/health";
import { claimJobRun, markJobRun } from "../db/jobRuns";
import { runDailyFeedIngest } from "../../scripts/ingest/dailyFeed";
import { runDailyMetricsIngest } from "../../scripts/ingest/dailyMetrics";

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

export type SchedulerClock = {
  /** Sydney calendar date, YYYY-MM-DD. */
  dateISO: string;
  /** Minutes since Sydney midnight (0–1439). */
  minutes: number;
  /** Day of week, 0 = Sunday … 6 = Saturday (Sydney). */
  dow: number;
};

/** Current wall-clock in Australia/Sydney (DST-correct via the platform tz db). */
export function sydneyClock(d: Date = new Date()): SchedulerClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0; // some ICU builds emit "24" at midnight
  const minutes = hour * 60 + Number(get("minute"));
  const dowMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    dateISO: `${get("year")}-${get("month")}-${get("day")}`,
    minutes,
    dow: dowMap[get("weekday")] ?? 0,
  };
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

type Job = {
  key: string;
  /** Sydney "HH:MM" — the earliest the job may run that day. */
  at: string;
  /** Restrict to these days (0=Sun…6=Sat). Omitted = every day. */
  dow?: number[];
  /**
   * Max attempts per day. Posting jobs (Instagram) set 1: a "failed" post may
   * actually have published (a timeout after the Graph API accepted it), so
   * retrying risks a duplicate. Ingest jobs are safe to retry (default 3).
   */
  maxAttempts?: number;
  run: (baseUrl: string, apiKey: string) => Promise<void>;
};

/**
 * Pure predicate (exported for tests): is the job due as of `clock`? True only
 * within the grace window after its time, so a long-overdue job is skipped
 * rather than fired retroactively.
 */
export function isJobDue(job: Job, clock: SchedulerClock): boolean {
  if (job.dow && !job.dow.includes(clock.dow)) return false;
  const at = hhmmToMinutes(job.at);
  return clock.minutes >= at && clock.minutes <= at + GRACE_MINUTES;
}

async function postLocal(baseUrl: string, apiKey: string, path: string): Promise<void> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-scheduled-key": apiKey },
    body: "{}",
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
const JOBS: Job[] = [
  { key: "daily-metrics", at: "06:33", run: (b, k) => runDailyMetricsIngest(b, k) },
  { key: "daily-feed", at: "06:43", run: (b, k) => runDailyFeedIngest(b, k) },
  { key: "instagram-daily", at: "07:13", maxAttempts: 1, run: (b, k) => postLocal(b, k, "/api/ingest/instagram-daily") },
  { key: "instagram-insights", at: "07:17", run: (b, k) => postLocal(b, k, "/api/ingest/instagram-insights") },
  { key: "instagram-coverage", at: "12:13", maxAttempts: 1, run: (b, k) => postLocal(b, k, "/api/ingest/instagram-coverage") },
  { key: "weekly-edition", at: "07:17", dow: [0], run: (b, k) => postLocal(b, k, "/api/ingest/synthesize-edition") },
  { key: "instagram-weekly", at: "09:19", dow: [0], maxAttempts: 1, run: (b, k) => postLocal(b, k, "/api/ingest/instagram-weekly") },
];

let ticking = false;

async function tick(baseUrl: string, apiKey: string): Promise<void> {
  if (ticking) return; // a slow run must not overlap the next interval
  ticking = true;
  try {
    const clock = sydneyClock();
    for (const job of JOBS) {
      if (!isJobDue(job, clock)) continue;
      const claimed = await claimJobRun(job.key, clock.dateISO, job.maxAttempts ?? 3);
      if (!claimed) continue;
      console.log(`[scheduler] running ${job.key} (${clock.dateISO})`);
      try {
        await job.run(baseUrl, apiKey);
        await markJobRun(job.key, clock.dateISO, "success");
        console.log(`[scheduler] ${job.key} ✓`);
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        console.error(`[scheduler] ${job.key} failed:`, msg);
        await markJobRun(job.key, clock.dateISO, "failed", msg.slice(0, 480));
        await recordServerError({
          level: "error",
          message: `[scheduler] ${job.key} failed: ${msg}`.slice(0, 512),
          route: "scheduler",
        }).catch(() => {});
      }
    }
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
    console.warn("[scheduler] SCHEDULED_API_KEY not set — cannot authenticate self-calls; not starting");
    return;
  }
  started = true;
  const baseUrl = `http://127.0.0.1:${opts.port}`;
  const apiKey = env.scheduledApiKey;
  console.log(
    `[scheduler] enabled — ${JOBS.length} jobs, polling every ${TICK_MINUTES}m (Sydney time)`
  );
  const fire = () => void tick(baseUrl, apiKey);
  setTimeout(fire, BOOT_DELAY_MS); // catch-up shortly after boot
  const handle = setInterval(fire, TICK_MINUTES * 60_000);
  // Don't keep the event loop alive solely for the timer.
  handle.unref?.();
}
