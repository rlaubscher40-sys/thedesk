import { and, asc, eq, gte, like, lte } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./client";
import { jobRuns } from "./schema";
import { isDemoMode } from "../demo/store";
import { readJobRun } from "./jobRuns";
import { validateFirstComment } from "../instagram/firstCommentCopy";

export const COMMENT_DATE = "1970-01-01";
export const COMMENT_MIN_AGE_MS = 5 * 60_000;
export const COMMENT_MAX_AGE_MS = 2 * 60 * 60_000;
const id = z.string().regex(/^\d{1,32}$/);
const sourceSchema = z.object({
  version: z.literal(1),
  mediaId: id,
  accountId: id,
  message: z.string(),
  enrolledAt: z.number().int().nonnegative(),
});
export type FirstCommentSource = z.infer<typeof sourceSchema>;

export function firstCommentKey(mediaId: string) {
  return `ig-comment-publish-${id.parse(mediaId)}`;
}

/** Insert in the same transaction as a NEW confirmed post record. A duplicate
 * media ID cannot enrol again or change the original question/date/account. */
export function firstCommentSourceRow(input: Omit<FirstCommentSource, "version">) {
  const source = sourceSchema.parse({ ...input, version: 1 });
  validateFirstComment(source.message);
  return {
    jobKey: `ig-comment-source-${source.mediaId}`,
    runDate: COMMENT_DATE,
    status: "success" as const,
    attempts: 1,
    detail: JSON.stringify(source),
    startedAt: new Date(source.enrolledAt),
    finishedAt: new Date(source.enrolledAt),
  };
}

function database() {
  const db = getDb();
  if (!db || isDemoMode()) throw new Error("Durable first-comment storage unavailable.");
  return db;
}

export async function pendingFirstComments(now: Date, accountId: string) {
  const rows = await database()
    .select()
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.runDate, COMMENT_DATE),
        like(jobRuns.jobKey, "ig-comment-source-%"),
        eq(jobRuns.status, "success"),
        gte(jobRuns.startedAt, new Date(now.getTime() - COMMENT_MAX_AGE_MS)),
        lte(jobRuns.startedAt, new Date(now.getTime() - COMMENT_MIN_AGE_MS))
      )
    )
    .orderBy(asc(jobRuns.startedAt))
    .limit(20);
  return rows.flatMap((row) => {
    try {
      const source = sourceSchema.parse(JSON.parse(row.detail ?? ""));
      validateFirstComment(source.message);
      const age = now.getTime() - source.enrolledAt;
      return row.jobKey === `ig-comment-source-${source.mediaId}` &&
        source.accountId === accountId &&
        age >= COMMENT_MIN_AGE_MS &&
        age <= COMMENT_MAX_AGE_MS
        ? [source]
        : [];
    } catch {
      return [];
    }
  });
}

export async function firstCommentPause(accountId: string) {
  return readJobRun(`ig-comment-pause-${id.parse(accountId)}`, COMMENT_DATE);
}

/** Account access/integrity failures stop the whole comment queue for 24h.
 * This never clears or retries an individual comment's permanent claim. */
export async function pauseFirstComments(accountId: string, reason: string, now: Date) {
  await database()
    .insert(jobRuns)
    .values({
      jobKey: `ig-comment-pause-${id.parse(accountId)}`,
      runDate: COMMENT_DATE,
      status: "failed",
      attempts: 1,
      startedAt: now,
      finishedAt: now,
      detail: reason,
    })
    .onDuplicateKeyUpdate({ set: { startedAt: now, finishedAt: now, detail: reason } });
}

export async function readFirstCommentReceipt(mediaId: string) {
  const row = await readJobRun(firstCommentKey(mediaId), COMMENT_DATE);
  if (!row) return { state: "not_attempted" as const };
  if (row.status === "success") {
    try {
      const value = JSON.parse(row.detail ?? "");
      if (value.version === 1 && value.mediaId === mediaId && id.safeParse(value.commentId).success)
        return { state: "published" as const, commentId: value.commentId as string };
    } catch {
      /* A damaged receipt is uncertainty. */
    }
  }
  return { state: "locked" as const };
}
