import { desc, eq, like, or, sql } from "drizzle-orm";
import type { EditionTopic } from "../../shared/schemas";
import { getDb } from "./client";
import { editions, type Edition, type InsertEdition } from "./schema";

export async function listEditions(): Promise<Edition[]> {
  const db = getDb();
  if (!db) return [];
  return db.select().from(editions).orderBy(desc(editions.editionNumber));
}

export async function getEditionById(id: number): Promise<Edition | undefined> {
  const db = getDb();
  if (!db) return undefined;
  const rows = await db.select().from(editions).where(eq(editions.id, id)).limit(1);
  return rows[0];
}

export async function getEditionByNumber(num: number): Promise<Edition | undefined> {
  const db = getDb();
  if (!db) return undefined;
  const rows = await db.select().from(editions).where(eq(editions.editionNumber, num)).limit(1);
  return rows[0];
}

export async function createEdition(data: InsertEdition) {
  const db = getDb();
  if (!db) throw new Error("createEdition: database unavailable");
  return db.insert(editions).values(data);
}

export async function updateRubensTake(id: number, rubensTake: string) {
  const db = getDb();
  if (!db) return;
  await db.update(editions).set({ rubensTake }).where(eq(editions.id, id));
}

export async function updateSubstackDraft(
  id: number,
  draft: { title: string; subtitle: string; body: string; imageUrl?: string | null }
) {
  const db = getDb();
  if (!db) return;
  await db
    .update(editions)
    .set({
      substackDraftTitle: draft.title,
      substackDraftSubtitle: draft.subtitle,
      substackDraftBody: draft.body,
      // Only overwrite the image when one was explicitly supplied so a body-only
      // resave doesn't blow away a previously generated image.
      ...(draft.imageUrl !== undefined ? { substackDraftImageUrl: draft.imageUrl } : {}),
    })
    .where(eq(editions.id, id));
}

export async function updateSubstackImage(id: number, imageUrl: string | null) {
  const db = getDb();
  if (!db) return;
  await db.update(editions).set({ substackDraftImageUrl: imageUrl }).where(eq(editions.id, id));
}

export async function updateHeroImage(id: number, heroImageUrl: string) {
  const db = getDb();
  if (!db) return;
  await db.update(editions).set({ heroImageUrl }).where(eq(editions.id, id));
}

export async function searchEditionFullText(query: string): Promise<Edition[]> {
  const db = getDb();
  if (!db) return [];
  const pattern = `%${query}%`;
  return db
    .select()
    .from(editions)
    .where(or(like(editions.fullText, pattern), like(editions.weekOf, pattern)))
    .orderBy(desc(editions.editionNumber));
}

export async function getEditionsByCategory(category: string): Promise<Edition[]> {
  const db = getDb();
  if (!db) return [];
  // Edition topics is a JSON array. We match against the JSON-serialised form
  // for upper/lower/title-cased category names so the ingestion casing doesn't
  // have to match the lookup casing exactly.
  const upper = `%"category":"${category.toUpperCase()}"%`;
  const lower = `%"category":"${category.toLowerCase()}"%`;
  const title = `%"category":"${category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()}"%`;
  return db
    .select()
    .from(editions)
    .where(
      or(
        like(sql`CAST(${editions.topics} AS CHAR)`, upper),
        like(sql`CAST(${editions.topics} AS CHAR)`, lower),
        like(sql`CAST(${editions.topics} AS CHAR)`, title)
      )
    )
    .orderBy(desc(editions.editionNumber));
}

export async function getRecentEditionsForMetrics(limit = 4) {
  const db = getDb();
  if (!db) return [];
  return db
    .select({
      id: editions.id,
      editionNumber: editions.editionNumber,
      weekOf: editions.weekOf,
      weekRange: editions.weekRange,
      keyMetrics: editions.keyMetrics,
      publishedAt: editions.publishedAt,
    })
    .from(editions)
    .orderBy(desc(editions.editionNumber))
    .limit(limit);
}

export async function getMetricHistory(limit = 12) {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: editions.id,
      editionNumber: editions.editionNumber,
      weekOf: editions.weekOf,
      weekRange: editions.weekRange,
      publishedAt: editions.publishedAt,
      keyMetrics: editions.keyMetrics,
    })
    .from(editions)
    .orderBy(desc(editions.editionNumber))
    .limit(limit);
  // Charts render left-to-right oldest-first.
  return rows.reverse();
}

export async function getSignalFrequency(editionLimit = 8) {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({
      editionNumber: editions.editionNumber,
      weekOf: editions.weekOf,
      topics: editions.topics,
      signals: editions.signals,
    })
    .from(editions)
    .orderBy(desc(editions.editionNumber))
    .limit(editionLimit);
  return rows.reverse().map((row) => {
    const topics: EditionTopic[] = row.topics ?? [];
    const counts: Record<string, number> = {};
    for (const t of topics) {
      const cat = (t.category || "OTHER").toUpperCase();
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return {
      editionNumber: row.editionNumber,
      weekOf: row.weekOf,
      categoryCounts: counts,
      signalCount: (row.signals ?? []).length,
      topicCount: topics.length,
    };
  });
}
