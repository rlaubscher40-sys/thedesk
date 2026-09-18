/**
 * Feedback submissions. Captured via the floating button on every page
 * during the partner-testing window; reviewed by the admin via the
 * dedicated panel on /admin.
 */
import { desc, eq } from "drizzle-orm";
import * as demoQueries from "../demo/queries";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import {
  feedbackSubmissions,
  type FeedbackSubmission,
  type InsertFeedbackSubmission,
} from "./schema";

export async function createFeedback(data: InsertFeedbackSubmission): Promise<void> {
  if (isDemoMode()) return demoQueries.createFeedback?.(data);
  const db = getDb();
  if (!db) return;
  await db.insert(feedbackSubmissions).values(data);
}

export async function listFeedback(): Promise<FeedbackSubmission[]> {
  if (isDemoMode()) return demoQueries.listFeedback?.() ?? [];
  const db = getDb();
  if (!db) return [];
  return db.select().from(feedbackSubmissions).orderBy(desc(feedbackSubmissions.createdAt));
}

export async function updateFeedbackStatus(id: number, status: "new" | "reviewed"): Promise<void> {
  if (isDemoMode()) return demoQueries.updateFeedbackStatus?.(id, status);
  const db = getDb();
  if (!db) return;
  await db.update(feedbackSubmissions).set({ status }).where(eq(feedbackSubmissions.id, id));
}

/**
 * Record what happened to a coverage request. `answerUrl` has already been
 * validated as a same-site published route by the router; only an "answered"
 * outcome may carry one, and any other outcome clears it, so a link cannot be
 * left behind on a request that was later declined.
 */
export async function recordRequestOutcome(
  id: number,
  status: "new" | "reviewed" | "answered" | "declined",
  answerUrl: string | null,
  now = new Date()
): Promise<void> {
  const answered = status === "answered" && answerUrl !== null;
  const patch = {
    status,
    answerUrl: answered ? answerUrl : null,
    answeredAt: answered ? now : null,
  };
  if (isDemoMode()) return demoQueries.recordRequestOutcome?.(id, patch);
  const db = getDb();
  if (!db) return;
  await db.update(feedbackSubmissions).set(patch).where(eq(feedbackSubmissions.id, id));
}

export async function deleteFeedback(id: number): Promise<void> {
  if (isDemoMode()) return demoQueries.deleteFeedback?.(id);
  const db = getDb();
  if (!db) return;
  await db.delete(feedbackSubmissions).where(eq(feedbackSubmissions.id, id));
}

export async function countNewFeedback(): Promise<number> {
  if (isDemoMode()) return demoQueries.countNewFeedback?.() ?? 0;
  const db = getDb();
  if (!db) return 0;
  const rows = await db
    .select()
    .from(feedbackSubmissions)
    .where(eq(feedbackSubmissions.status, "new"));
  return rows.length;
}
