import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb } from "./client";
import { isDemoMode } from "../demo/store";
import { invalidate } from "../core/cache";
import { assertPublicationAllowed } from "./publicationControls";
import { publicationControls } from "./publicationControls";

export function legalStoryFingerprint(row: {
  title: string;
  summary?: string | null;
  sourceUrl?: string | null;
}) {
  return createHash("sha256")
    .update(JSON.stringify([row.title, row.summary ?? null, row.sourceUrl ?? null]))
    .digest("hex");
}
export type LegalReview = {
  feedItemId: number;
  title: string;
  summary: string | null;
  sourceUrl: string | null;
  originalChannel: string;
  reasons: string[];
  status: string;
};
export async function pendingLegalReviews(): Promise<LegalReview[]> {
  if (isDemoMode()) return [];
  const db = getDb();
  if (!db) throw new Error("Review database unavailable");
  const [rows] = await db.execute(sql`SELECT r.feedItemId, f.title, f.summary, f.sourceUrl,
    r.originalChannel, r.reasons, r.status FROM legal_story_reviews r
    JOIN daily_feed_items f ON f.id=r.feedItemId WHERE r.status='pending'
    ORDER BY r.createdAt DESC LIMIT 100`);
  return (rows as unknown as LegalReview[]).map((r) => ({
    ...r,
    reasons: typeof r.reasons === "string" ? JSON.parse(r.reasons) : r.reasons,
  }));
}
/** Approval returns the item to its original feed lane. It does not force an
 * email/social replay or rewrite a previously frozen email. */
export async function decideLegalReview(input: {
  feedItemId: number;
  decision: "approve" | "reject";
  note: string;
  actorId: number;
}) {
  if (isDemoMode()) throw new Error("No real review items exist in demo mode");
  if (input.decision === "approve") await assertPublicationAllowed("website");
  const db = getDb();
  if (!db) throw new Error("Review database unavailable");
  await db.transaction(async (tx) => {
    const [rows] = await tx.execute(
      sql`SELECT originalChannel, status, contentHash FROM legal_story_reviews WHERE feedItemId=${input.feedItemId} FOR UPDATE`
    );
    const row = (
      rows as unknown as Array<{ originalChannel: string; status: string; contentHash: string }>
    )[0];
    if (!row || row.status !== "pending")
      throw new Error("Review already resolved or unavailable; refresh the queue");
    if (input.decision === "approve") {
      const [stories] = await tx.execute(
        sql`SELECT title, summary, sourceUrl FROM daily_feed_items WHERE id=${input.feedItemId} FOR UPDATE`
      );
      const story = (
        stories as unknown as Array<{ title: string; summary: string; sourceUrl: string | null }>
      )[0];
      if (!story || legalStoryFingerprint(story) !== row.contentHash)
        throw new Error("Story text changed after the hold; a new review is required");
      const [jobs] = await tx.execute(
        sql`SELECT status FROM feed_enrichment_jobs WHERE feedItemId=${input.feedItemId} FOR UPDATE`
      );
      if ((jobs as unknown as Array<{ status: string }>)[0]?.status === "skipped")
        throw new Error("Review evidence expired; prepare a new story from current sources");
      if (!["AU", "PROPERTY", "BUSINESS", "TECH", "GLOBAL"].includes(row.originalChannel))
        throw new Error("Invalid original channel");
      const [result] =
        await tx.execute(sql`UPDATE daily_feed_items SET channel=${row.originalChannel}
        WHERE id=${input.feedItemId} AND channel='HOLD'`);
      if ((result as unknown as { affectedRows: number }).affectedRows !== 1)
        throw new Error("Story changed; inspect it before approval");
    }
    if (input.decision === "approve") {
      await tx.execute(sql`UPDATE feed_enrichment_jobs SET status='pending', availableAt=CURRENT_TIMESTAMP
        WHERE feedItemId=${input.feedItemId} AND status='legal-held'`);
    } else {
      await tx.execute(sql`UPDATE feed_enrichment_jobs SET status='skipped', input=NULL, finishedAt=CURRENT_TIMESTAMP, reason='legal_review_rejected'
        WHERE feedItemId=${input.feedItemId} AND status='legal-held'`);
    }
    await tx.execute(sql`UPDATE legal_story_reviews SET status=${input.decision === "approve" ? "approved" : "rejected"},
      decisionNote=${input.note.trim()}, actorId=${input.actorId}, reviewedAt=CURRENT_TIMESTAMP WHERE feedItemId=${input.feedItemId}`);
    await tx.execute(sql`INSERT INTO legal_review_events (feedItemId, action, note, actorId)
      VALUES (${input.feedItemId}, ${input.decision}, ${input.note.trim()}, ${input.actorId})`);
  });
  invalidate();
}

/** Emergency website hold. Require the shared pause first because email
 * snapshots and social render jobs may already contain the published story. */
export async function holdPublishedStory(input: {
  feedItemId: number;
  note: string;
  actorId: number;
}) {
  if (isDemoMode()) throw new Error("No real takedowns in demo mode");
  if (!(await publicationControls()).some((c) => c.channel === "all" && c.paused))
    throw new Error(
      "Pause all publishing before holding a published story; queued copies need review"
    );
  const db = getDb();
  if (!db) throw new Error("Review database unavailable");
  await db.transaction(async (tx) => {
    // Same lock order as a review decision, including when no review exists yet.
    const [reviews] = await tx.execute(
      sql`SELECT originalChannel FROM legal_story_reviews WHERE feedItemId=${input.feedItemId} FOR UPDATE`
    );
    const [rows] = await tx.execute(
      sql`SELECT title, summary, sourceUrl, channel FROM daily_feed_items WHERE id=${input.feedItemId} FOR UPDATE`
    );
    const row = (
      rows as unknown as Array<{
        title: string;
        summary: string;
        sourceUrl: string | null;
        channel: string;
      }>
    )[0];
    if (!row) throw new Error("Story not found");
    const originalChannel =
      row.channel === "HOLD"
        ? (reviews as unknown as Array<{ originalChannel: string }>)[0]?.originalChannel
        : row.channel;
    if (
      !originalChannel ||
      !["AU", "PROPERTY", "BUSINESS", "TECH", "GLOBAL"].includes(originalChannel)
    )
      throw new Error("This story is held by another process; inspect its original review");
    const reasons = JSON.stringify(["Editor requested a publication hold"]);
    await tx.execute(sql`INSERT INTO legal_story_reviews (feedItemId, originalChannel, contentHash, reasons)
      VALUES (${input.feedItemId}, ${originalChannel}, ${legalStoryFingerprint(row)}, ${reasons})
      ON DUPLICATE KEY UPDATE contentHash=${legalStoryFingerprint(row)}, reasons=${reasons}, status='pending', decisionNote=NULL, reviewedAt=NULL, actorId=NULL`);
    await tx.execute(sql`UPDATE daily_feed_items SET channel='HOLD' WHERE id=${input.feedItemId}`);
    await tx.execute(sql`INSERT INTO legal_review_events (feedItemId, action, note, actorId)
      VALUES (${input.feedItemId}, 'hold', ${input.note.trim()}, ${input.actorId})`);
  });
  invalidate();
}
