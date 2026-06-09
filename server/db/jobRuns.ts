/**
 * Watermark for the in-process scheduler (see server/scheduler).
 *
 * `claimJobRun` is the concurrency primitive: it atomically reserves
 * (jobKey, runDate) so a job runs at most once per Sydney day, survives a
 * bounded number of retries after a failure, and is safe even if two server
 * instances tick simultaneously (the unique key means exactly one INSERT
 * wins; a re-claim after failure is a conditional UPDATE that only one can
 * match). All best-effort: on a missing table / DB outage these no-op so a
 * scheduler blip never crashes the server.
 */
import { and, eq, lt, sql } from "drizzle-orm";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import { jobRuns } from "./schema";

function affectedRows(result: unknown): number {
  return Number((result as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0);
}

/**
 * Try to claim today's run of `jobKey`. Returns the attempt number this caller
 * is executing (1 for the first run of the day, 2.. for a retry) — or 0 when
 * the job is NOT claimable (already running/succeeded, retries exhausted, or
 * DB unavailable). The attempt number lets the scheduler tell a transient
 * failure (will retry) from a terminal one (won't), so it can alert only once.
 *
 * A fresh day inserts a 'running' row; a prior 'failed' row is re-claimed up
 * to `maxAttempts` so transient failures self-heal; a 'running' or 'success'
 * row means someone else owns/finished it → 0.
 */
export async function claimJobRun(
  jobKey: string,
  runDate: string,
  maxAttempts = 3
): Promise<number> {
  if (isDemoMode()) return 0;
  const db = getDb();
  if (!db) return 0;

  try {
    await db.insert(jobRuns).values({ jobKey, runDate, status: "running", attempts: 1 });
    return 1; // first claim of the day
  } catch {
    // Row exists. Re-claim only if the last attempt failed and we're under the
    // retry cap. The WHERE status='failed' makes this atomic: if two ticks race,
    // the first flips it to 'running' and the second matches zero rows.
    try {
      const result = await db
        .update(jobRuns)
        .set({
          status: "running",
          attempts: sql`${jobRuns.attempts} + 1`,
          startedAt: new Date(),
          finishedAt: null,
        })
        .where(
          and(
            eq(jobRuns.jobKey, jobKey),
            eq(jobRuns.runDate, runDate),
            eq(jobRuns.status, "failed"),
            lt(jobRuns.attempts, maxAttempts)
          )
        );
      if (affectedRows(result) === 0) return 0; // lost the race / out of retries
      // We won the re-claim; read back the now-incremented attempt number.
      const rows = await db
        .select({ attempts: jobRuns.attempts })
        .from(jobRuns)
        .where(and(eq(jobRuns.jobKey, jobKey), eq(jobRuns.runDate, runDate)))
        .limit(1);
      return rows[0]?.attempts ?? 2;
    } catch {
      return 0;
    }
  }
}

/** Mark a claimed run finished. `detail` carries an error summary on failure. */
export async function markJobRun(
  jobKey: string,
  runDate: string,
  status: "success" | "failed",
  detail?: string | null
): Promise<void> {
  if (isDemoMode()) return;
  const db = getDb();
  if (!db) return;
  try {
    await db
      .update(jobRuns)
      .set({ status, detail: detail ?? null, finishedAt: new Date() })
      .where(and(eq(jobRuns.jobKey, jobKey), eq(jobRuns.runDate, runDate)));
  } catch (err) {
    console.warn(`[scheduler] markJobRun(${jobKey}) failed:`, (err as Error).message);
  }
}
