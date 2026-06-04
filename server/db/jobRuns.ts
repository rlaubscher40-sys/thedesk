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
 * Try to claim today's run of `jobKey`. Returns true if THIS caller should
 * execute the job. A fresh day inserts a 'running' row; a prior 'failed' row
 * is re-claimed up to `maxAttempts` so transient failures self-heal; a
 * 'running' or 'success' row means someone else owns/finished it → false.
 */
export async function claimJobRun(
  jobKey: string,
  runDate: string,
  maxAttempts = 3
): Promise<boolean> {
  if (isDemoMode()) return false;
  const db = getDb();
  if (!db) return false;

  try {
    await db.insert(jobRuns).values({ jobKey, runDate, status: "running", attempts: 1 });
    return true; // first claim of the day
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
      return affectedRows(result) > 0;
    } catch {
      return false;
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
