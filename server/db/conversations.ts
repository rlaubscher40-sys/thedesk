import { desc, eq } from "drizzle-orm";
import { getDb } from "./client";
import {
  conversationTracker,
  type ConversationEntry,
  type InsertConversationEntry,
} from "./schema";

export async function listConversationEntries(userId: number): Promise<ConversationEntry[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(conversationTracker)
    .where(eq(conversationTracker.userId, userId))
    .orderBy(desc(conversationTracker.usedAt));
}

export async function addConversationEntry(data: InsertConversationEntry) {
  const db = getDb();
  if (!db) throw new Error("addConversationEntry: database unavailable");
  return db.insert(conversationTracker).values(data);
}
