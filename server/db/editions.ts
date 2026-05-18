import { desc, eq, like, or, sql } from "drizzle-orm";
import type { EditionTopic } from "../../shared/schemas";
import * as demoQueries from "../demo/queries";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import { editions, type Edition, type InsertEdition } from "./schema";

export async function listEditions(): Promise<Edition[]> {
  if (isDemoMode()) return demoQueries.listEditions();
  const db = getDb();
  if (!db) return [];
  return db.select().from(editions).orderBy(desc(editions.editionNumber));
}

/**
 * Lean list for list views. Drops the heavy text columns the editions
 * list / picker / Trends hero never read:
 *   - `fullText`       , multi-KB editor's letter
 *   - `substackDraftBody`, multi-KB essay draft
 *   - `topics`         , JSON deck (only needed when reading one edition)
 *   - `signals`        , array of strings, only used in the reader
 *
 * On a 30-edition list this cuts the JSON payload from MBs to tens of
 * KBs and keeps the React Query cache lightweight on mobile.
 *
 * `hasDraft` is computed in SQL so the caller still knows whether a
 * draft exists without us shipping the draft body.
 */
export async function listEditionSummaries() {
  if (isDemoMode()) {
    return demoQueries.listEditions().map((ed) => ({
      id: ed.id,
      editionNumber: ed.editionNumber,
      weekOf: ed.weekOf,
      weekRange: ed.weekRange,
      publishedAt: ed.publishedAt,
      readingTime: ed.readingTime,
      heroImageUrl: ed.heroImageUrl,
      rubensTake: ed.rubensTake,
      keyMetrics: ed.keyMetrics,
      marketStress: ed.marketStress,
      datesToWatch: ed.datesToWatch,
      metaTitle: ed.metaTitle,
      socialTitle: ed.socialTitle,
      hasDraft: Boolean(ed.substackDraftBody && ed.substackDraftBody.length > 0),
    }));
  }
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: editions.id,
      editionNumber: editions.editionNumber,
      weekOf: editions.weekOf,
      weekRange: editions.weekRange,
      publishedAt: editions.publishedAt,
      readingTime: editions.readingTime,
      heroImageUrl: editions.heroImageUrl,
      rubensTake: editions.rubensTake,
      keyMetrics: editions.keyMetrics,
      marketStress: editions.marketStress,
      datesToWatch: editions.datesToWatch,
      metaTitle: editions.metaTitle,
      socialTitle: editions.socialTitle,
      // SQL-side boolean, "draft exists with non-empty body".
      hasDraft: sql<boolean>`(${editions.substackDraftBody} IS NOT NULL AND ${editions.substackDraftBody} <> '')`,
    })
    .from(editions)
    .orderBy(desc(editions.editionNumber));
  return rows;
}

export type EditionSummary = Awaited<ReturnType<typeof listEditionSummaries>>[number];

/** Returns the next free editionNumber. Used by the weekly synthesis to assign
 *  the new edition without the caller having to think about numbering. */
export async function getNextEditionNumber(): Promise<number> {
  if (isDemoMode()) {
    const rows = demoQueries.listEditions();
    const max = rows.reduce((m, r) => Math.max(m, r.editionNumber), 0);
    return max + 1;
  }
  const db = getDb();
  if (!db) return 1;
  const rows = await db
    .select({ editionNumber: editions.editionNumber })
    .from(editions)
    .orderBy(desc(editions.editionNumber))
    .limit(1);
  return (rows[0]?.editionNumber ?? 0) + 1;
}

export async function getEditionById(id: number): Promise<Edition | undefined> {
  if (isDemoMode()) return demoQueries.getEditionById(id);
  const db = getDb();
  if (!db) return undefined;
  const rows = await db.select().from(editions).where(eq(editions.id, id)).limit(1);
  return rows[0];
}

export async function getEditionByNumber(num: number): Promise<Edition | undefined> {
  if (isDemoMode()) return demoQueries.getEditionByNumber(num);
  const db = getDb();
  if (!db) return undefined;
  const rows = await db.select().from(editions).where(eq(editions.editionNumber, num)).limit(1);
  return rows[0];
}

export async function createEdition(data: InsertEdition) {
  if (isDemoMode()) return demoQueries.createEdition(data);
  const db = getDb();
  if (!db) throw new Error("createEdition: database unavailable");
  return db.insert(editions).values(data);
}

export async function deleteEdition(id: number): Promise<void> {
  if (isDemoMode()) return demoQueries.deleteEdition(id);
  const db = getDb();
  if (!db) return;
  await db.delete(editions).where(eq(editions.id, id));
}

export async function updateRubensTake(id: number, rubensTake: string) {
  if (isDemoMode()) return demoQueries.updateRubensTake(id, rubensTake);
  const db = getDb();
  if (!db) return;
  await db.update(editions).set({ rubensTake }).where(eq(editions.id, id));
}

export async function updateSubstackDraft(
  id: number,
  draft: { title: string; subtitle: string; body: string; imageUrl?: string | null }
) {
  if (isDemoMode()) return demoQueries.updateSubstackDraft(id, draft);
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
  if (isDemoMode()) return demoQueries.updateSubstackImage(id, imageUrl);
  const db = getDb();
  if (!db) return;
  await db.update(editions).set({ substackDraftImageUrl: imageUrl }).where(eq(editions.id, id));
}

export async function updateHeroImage(id: number, heroImageUrl: string) {
  if (isDemoMode()) return demoQueries.updateHeroImage(id, heroImageUrl);
  const db = getDb();
  if (!db) return;
  await db.update(editions).set({ heroImageUrl }).where(eq(editions.id, id));
}

/**
 * Replace the synthesised topic deck / signals / letter on an edition.
 * Used by the editor-QC pass to apply revisions after the initial insert.
 */
export async function updateEditionSynthesis(
  id: number,
  patch: {
    topics?: EditionTopic[];
    signals?: string[];
    fullText?: string | null;
    keyMetrics?: Record<string, string | number>;
    marketStress?: string | null;
    datesToWatch?: { label: string; description: string }[] | null;
  }
) {
  if (isDemoMode()) return demoQueries.updateEditionSynthesis?.(id, patch);
  const db = getDb();
  if (!db) return;
  await db.update(editions).set(patch).where(eq(editions.id, id));
}

/**
 * Save the SEO + headline-variants block on an edition. Written by the
 * headline-optimiser pass; consumed by the edition page's <head> renderer
 * and the admin headline picker.
 */
export async function updateEditionSeo(
  id: number,
  seo: {
    metaTitle: string;
    metaDescription: string;
    socialTitle: string;
    socialDescription: string;
    headlineVariants: string[];
  }
) {
  if (isDemoMode()) return demoQueries.updateEditionSeo?.(id, seo);
  const db = getDb();
  if (!db) return;
  await db
    .update(editions)
    .set({
      metaTitle: seo.metaTitle,
      metaDescription: seo.metaDescription,
      socialTitle: seo.socialTitle,
      socialDescription: seo.socialDescription,
      headlineVariants: seo.headlineVariants,
    })
    .where(eq(editions.id, id));
}

export async function searchEditionFullText(query: string): Promise<Edition[]> {
  if (isDemoMode()) return demoQueries.searchEditionFullText(query);
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
  if (isDemoMode()) return demoQueries.getEditionsByCategory(category);
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
  if (isDemoMode()) return demoQueries.getRecentEditionsForMetrics(limit);
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
  if (isDemoMode()) return demoQueries.getMetricHistory(limit);
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
  if (isDemoMode()) return demoQueries.getSignalFrequency(editionLimit);
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
