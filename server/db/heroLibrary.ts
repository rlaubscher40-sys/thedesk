/**
 * Hero image library — a small pool of reusable editorial covers that
 * the weekly-edition cron cycles through least-recently-used first,
 * instead of burning an OpenAI image-gen call every Sunday.
 *
 * Library rows live in `hero_library` and are independent of any
 * single edition. When the cron picks one, it copies the bytes into
 * `edition_assets` for that edition (so the edition page's
 * `/api/images/edition/:id/hero` URL still works unchanged) and bumps
 * the library row's `lastUsedAt` + `usedCount`.
 */
import { asc, desc, eq, sql } from "drizzle-orm";
import * as demoQueries from "../demo/queries";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import {
  heroLibrary,
  type HeroLibraryItem,
  type InsertHeroLibraryItem,
} from "./schema";

/**
 * Lightweight projection — same columns as the row but without the
 * mediumblob bytes. Used by the admin list view, which renders
 * thumbnails via the public `/api/images/hero-library/:id` route
 * rather than shipping every blob inline.
 */
export type HeroLibraryListItem = Omit<HeroLibraryItem, "bytes">;

const LIST_COLUMNS = {
  id: heroLibrary.id,
  label: heroLibrary.label,
  promptUsed: heroLibrary.promptUsed,
  contentType: heroLibrary.contentType,
  retired: heroLibrary.retired,
  lastUsedAt: heroLibrary.lastUsedAt,
  usedCount: heroLibrary.usedCount,
  createdAt: heroLibrary.createdAt,
};

/** All library rows, newest first. No bytes — admin list view only. */
export async function listHeroLibrary(): Promise<HeroLibraryListItem[]> {
  if (isDemoMode()) {
    return demoQueries.listHeroLibrary?.() ?? [];
  }
  const db = getDb();
  if (!db) return [];
  return db
    .select(LIST_COLUMNS)
    .from(heroLibrary)
    .orderBy(desc(heroLibrary.createdAt));
}

/**
 * Pick the next library image for an edition: least-recently-used,
 * never-used first (lastUsedAt NULL sorts first under ASC on MySQL).
 * Excludes retired rows. Returns null if the library is empty.
 */
export async function pickLeastRecentlyUsedHero(): Promise<HeroLibraryItem | null> {
  if (isDemoMode()) {
    return demoQueries.pickLeastRecentlyUsedHero?.() ?? null;
  }
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(heroLibrary)
    .where(eq(heroLibrary.retired, false))
    .orderBy(asc(heroLibrary.lastUsedAt), asc(heroLibrary.id))
    .limit(1);
  return rows[0] ?? null;
}

/** Fetch a single library row's bytes for the public image route. */
export async function getHeroLibraryBytes(
  id: number
): Promise<HeroLibraryItem | null> {
  if (isDemoMode()) {
    return demoQueries.getHeroLibraryBytes?.(id) ?? null;
  }
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(heroLibrary)
    .where(eq(heroLibrary.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function storeHeroLibraryItem(args: {
  label?: string | null;
  promptUsed?: string | null;
  contentType: string;
  bytes: Buffer;
}): Promise<number> {
  if (isDemoMode()) {
    return demoQueries.storeHeroLibraryItem?.(args) ?? 0;
  }
  const db = getDb();
  if (!db) throw new Error("storeHeroLibraryItem: database unavailable");
  const row: InsertHeroLibraryItem = {
    label: args.label ?? null,
    promptUsed: args.promptUsed ?? null,
    contentType: args.contentType,
    bytes: args.bytes,
  };
  const result = await db.insert(heroLibrary).values(row);
  return Number(
    (result as unknown as Array<{ insertId?: number }>)[0]?.insertId ?? 0
  );
}

/** Stamp the row's lastUsedAt and bump usedCount. Called after a
 *  successful library pick is bound to an edition. */
export async function markHeroLibraryUsed(id: number): Promise<void> {
  if (isDemoMode()) {
    demoQueries.markHeroLibraryUsed?.(id);
    return;
  }
  const db = getDb();
  if (!db) return;
  await db
    .update(heroLibrary)
    .set({
      lastUsedAt: new Date(),
      usedCount: sql`${heroLibrary.usedCount} + 1`,
    })
    .where(eq(heroLibrary.id, id));
}

export async function setHeroLibraryRetired(
  id: number,
  retired: boolean
): Promise<void> {
  if (isDemoMode()) {
    demoQueries.setHeroLibraryRetired?.(id, retired);
    return;
  }
  const db = getDb();
  if (!db) return;
  await db
    .update(heroLibrary)
    .set({ retired })
    .where(eq(heroLibrary.id, id));
}

export async function setHeroLibraryLabel(
  id: number,
  label: string | null
): Promise<void> {
  if (isDemoMode()) {
    demoQueries.setHeroLibraryLabel?.(id, label);
    return;
  }
  const db = getDb();
  if (!db) return;
  await db
    .update(heroLibrary)
    .set({ label })
    .where(eq(heroLibrary.id, id));
}

export async function deleteHeroLibraryItem(id: number): Promise<void> {
  if (isDemoMode()) {
    demoQueries.deleteHeroLibraryItem?.(id);
    return;
  }
  const db = getDb();
  if (!db) return;
  await db.delete(heroLibrary).where(eq(heroLibrary.id, id));
}

/** Build the public URL for a library image. */
export function heroLibraryUrl(id: number): string {
  return `/api/images/hero-library/${id}`;
}
