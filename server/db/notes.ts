import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./client";
import { weeklyNotes, type InsertWeeklyNote, type WeeklyNote } from "./schema";

export async function getNote(userId: number, weekId: string): Promise<WeeklyNote | undefined> {
  const db = getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(weeklyNotes)
    .where(and(eq(weeklyNotes.userId, userId), eq(weeklyNotes.weekId, weekId)))
    .limit(1);
  return rows[0];
}

export async function listNotes(userId: number): Promise<WeeklyNote[]> {
  const db = getDb();
  if (!db) return [];
  return db.select().from(weeklyNotes).where(eq(weeklyNotes.userId, userId)).orderBy(desc(weeklyNotes.weekId));
}

export async function upsertNote(data: InsertWeeklyNote) {
  const db = getDb();
  if (!db) throw new Error("upsertNote: database unavailable");
  const existing = await db
    .select({ id: weeklyNotes.id })
    .from(weeklyNotes)
    .where(and(eq(weeklyNotes.userId, data.userId), eq(weeklyNotes.weekId, data.weekId)))
    .limit(1);
  if (existing[0]) {
    return db.update(weeklyNotes).set({ content: data.content }).where(eq(weeklyNotes.id, existing[0].id));
  }
  return db.insert(weeklyNotes).values(data);
}

export async function deleteNote(userId: number, weekId: string) {
  const db = getDb();
  if (!db) return;
  return db.delete(weeklyNotes).where(and(eq(weeklyNotes.userId, userId), eq(weeklyNotes.weekId, weekId)));
}
