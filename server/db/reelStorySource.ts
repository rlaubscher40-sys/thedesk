import { createHash } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { getDb } from "./client";
import { jobRuns } from "./schema";
import { isDemoMode } from "../demo/store";
import { readJobRun } from "./jobRuns";
import type { ReelStat } from "../video/statReel";
import type { ScriptLine } from "../video/narration";

export type ReelStorySource = {
  version: 1;
  stat: ReelStat;
  script: ScriptLine[];
  siteUrl: string;
};
export function reelStorySourceKey(publication: { key: string; date: string }) {
  return `reel-story-source-${createHash("sha256")
    .update(JSON.stringify([publication.key, publication.date]))
    .digest("hex")
    .slice(0, 32)}`;
}

/** Only called by the winner of the permanent Reel claim, before Meta publish.
 * A crash after Reel confirmation can therefore recover this immutable source.
 * These separate rows never change a Reel publication or delivery record. */
export async function stageReelStorySource(
  publication: { key: string; date: string },
  source: ReelStorySource
) {
  const db = getDb();
  if (!db || isDemoMode()) throw new Error("Durable Story source storage unavailable.");
  const detail = JSON.stringify(source);
  if (Buffer.byteLength(detail) > 60_000) throw new Error("Story source exceeds storage budget.");
  await db.insert(jobRuns).values({
    jobKey: reelStorySourceKey(publication),
    runDate: publication.date,
    status: "success",
    attempts: 1,
    detail,
    finishedAt: new Date(),
  });
}

export async function readReelStorySource(publication: { key: string; date: string }) {
  const row = await readJobRun(reelStorySourceKey(publication), publication.date);
  if (!row) return null;
  if (row.status !== "success" || !row.detail) throw new Error("Story source is incomplete.");
  const source = JSON.parse(row.detail) as ReelStorySource;
  if (
    source.version !== 1 ||
    !source.stat ||
    !Array.isArray(source.script) ||
    new URL(source.siteUrl).protocol !== "https:"
  )
    throw new Error("Invalid Story source.");
  if (source.stat.asOf) source.stat.asOf = new Date(source.stat.asOf);
  return source;
}

/** Expire preparation only. The separate non-idempotent publication lock
 * is deliberately outside this allowlist, including uncertain outcomes. */
export async function expireReelStoryPreparation(key: string, date: string, cutoff: Date) {
  if (!/^reel-story-prepare-\d+$/.test(key)) throw new Error("Only Story preparation can expire.");
  const db = getDb();
  if (!db || isDemoMode()) throw new Error("Durable Story preparation unavailable.");
  await db
    .update(jobRuns)
    .set({ status: "failed", detail: "Interrupted preparation." })
    .where(
      and(
        eq(jobRuns.jobKey, key),
        eq(jobRuns.runDate, date),
        eq(jobRuns.status, "running"),
        lt(jobRuns.startedAt, cutoff),
        lt(jobRuns.attempts, 2)
      )
    );
}
