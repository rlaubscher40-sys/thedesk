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

export async function createFeedback(
  data: InsertFeedbackSubmission
): Promise<void> {
  if (isDemoMode()) return demoQueries.createFeedback?.(data);
  const db = getDb();
  if (!db) return;
  await db.insert(feedbackSubmissions).values(data);
}

export async function listFeedback(): Promise<FeedbackSubmission[]> {
  if (isDemoMode()) return demoQueries.listFeedback?.() ?? [];
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(feedbackSubmissions)
    .orderBy(desc(feedbackSubmissions.createdAt));
}

export async function updateFeedbackStatus(
  id: number,
  status: "new" | "reviewed"
): Promise<void> {
  if (isDemoMode()) return demoQueries.updateFeedbackStatus?.(id, status);
  const db = getDb();
  if (!db) return;
  await db
    .update(feedbackSubmissions)
    .set({ status })
    .where(eq(feedbackSubmissions.id, id));
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
