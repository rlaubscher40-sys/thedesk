import { AsyncLocalStorage } from "node:async_hooks";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { isDemoMode } from "../demo/store";
import { jobRuns } from "./schema";

// Only repeatable data collectors may expire. Publication and email locks
// deliberately keep their existing semantics.
export function isCollectionJob(key: string): boolean {
  return (
    key === "daily-metrics" ||
    /^local-data-(?:abs-sa2-population|nsw-bond-rents|qld-bond-rents)$/.test(key) ||
    /^official-metrics-(?:12|18)$/.test(key) ||
    /^official-metrics-recovery-(?:00|04|08|12|16|20)$/.test(key) ||
    /^property-evidence-(?:[01]\d|2[0-3])$/.test(key)
  );
}

export const COLLECTION_DEADLINE_MS = 10 * 60_000;
export const COLLECTION_LEASE_MS = 15 * 60_000;
export const collectionRetryDelay = (attempt: number) =>
  Math.min(60, 15 * 2 ** Math.max(0, attempt - 1)) * 60_000;

export type CollectionLease = {
  jobKey: string;
  runDate: string;
  attempt: number;
};
type Database = NonNullable<ReturnType<typeof getDb>>;
export type CollectionTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];
const context = new AsyncLocalStorage<{
  lease: CollectionLease;
  signal: AbortSignal;
}>();
const writeContext = new AsyncLocalStorage<CollectionTransaction>();

export function collectionSignal(): AbortSignal | undefined {
  return context.getStore()?.signal;
}

function requireDb() {
  const db = getDb();
  if (!db || isDemoMode())
    throw new Error("Collection requires a live database");
  return db;
}

/** Transactional claim uses the existing unique (jobKey, runDate) record.
 * The attempt number fences both completion and data writes after a restart. */
export async function claimCollectionRun(
  jobKey: string,
  runDate: string,
  maxAttempts = 3,
  now = new Date(),
): Promise<CollectionLease | null> {
  if (!isCollectionJob(jobKey))
    throw new Error("Only data collection jobs can expire");
  return requireDb().transaction(async (tx) => {
    await tx
      .insert(jobRuns)
      .values({
        jobKey,
        runDate,
        status: "pending",
        attempts: 0,
        startedAt: now,
      })
      .onDuplicateKeyUpdate({ set: { jobKey: sql`${jobRuns.jobKey}` } });
    const [row] = await tx
      .select()
      .from(jobRuns)
      .where(and(eq(jobRuns.jobKey, jobKey), eq(jobRuns.runDate, runDate)))
      .for("update");
    if (!row || row.status === "success") return null;
    if (row.attempts >= maxAttempts) {
      if (
        row.status === "running" &&
        now.getTime() - row.startedAt.getTime() >= COLLECTION_LEASE_MS
      ) {
        await tx
          .update(jobRuns)
          .set({
            status: "failed",
            finishedAt: now,
            detail:
              "Collection interrupted on its final attempt; next collection window will retry.",
          })
          .where(eq(jobRuns.id, row.id));
      }
      return null;
    }
    if (
      row.status === "running" &&
      now.getTime() - row.startedAt.getTime() < COLLECTION_LEASE_MS
    )
      return null;
    if (
      row.status === "failed" &&
      (!row.finishedAt ||
        now.getTime() - row.finishedAt.getTime() <
          collectionRetryDelay(row.attempts))
    )
      return null;
    if (!["pending", "running", "failed"].includes(row.status)) return null;
    const attempt = row.attempts + 1;
    await tx
      .update(jobRuns)
      .set({
        status: "running",
        attempts: attempt,
        startedAt: now,
        finishedAt: null,
        detail: null,
      })
      .where(eq(jobRuns.id, row.id));
    return { jobKey, runDate, attempt };
  });
}

function owned(lease: CollectionLease) {
  return and(
    eq(jobRuns.jobKey, lease.jobKey),
    eq(jobRuns.runDate, lease.runDate),
    eq(jobRuns.status, "running"),
    eq(jobRuns.attempts, lease.attempt),
  );
}

export async function finishCollectionRun(
  lease: CollectionLease,
  status: "success" | "failed",
  detail?: string,
): Promise<boolean> {
  const result = await requireDb()
    .update(jobRuns)
    .set({
      status,
      detail: detail?.slice(0, 2000) ?? null,
      finishedAt: new Date(),
    })
    .where(owned(lease));
  return (
    Number(
      (result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows,
    ) === 1
  );
}

/** Hold the job row lock until the data transaction commits. An expired
 * worker cannot race a new claim and overwrite the replacement's results. */
export async function withCollectionWrite<T>(
  write: (db: Database | CollectionTransaction) => Promise<T>,
): Promise<T> {
  const active = context.getStore();
  const db = requireDb();
  if (!active) return write(db);
  active.signal.throwIfAborted();
  const currentTransaction = writeContext.getStore();
  if (currentTransaction) return write(currentTransaction);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(jobRuns)
      .where(owned(active.lease))
      .for("update");
    active.signal.throwIfAborted();
    if (!row) throw new Error("Collection attempt no longer owns its lease");
    const result = await writeContext.run(tx, () => write(tx));
    // A deadline during a write rolls the transaction back too.
    active.signal.throwIfAborted();
    return result;
  });
}

/** Stop waiting after ten minutes. Late tasks retain the aborted context,
 * so neither metric nor source-health writes may escape into a later run. */
export async function runCollectionAttempt(
  lease: CollectionLease,
  run: () => Promise<void>,
  timeoutMs = COLLECTION_DEADLINE_MS,
) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      context.run({ lease, signal: controller.signal }, run),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error("Collection exceeded its time limit");
          controller.abort(error);
          reject(error);
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    controller.abort(new Error("Collection attempt ended"));
  }
}
