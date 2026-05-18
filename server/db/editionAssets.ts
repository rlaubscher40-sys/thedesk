/**
 * Storage for AI-generated edition images. Each image is a row in
 * `edition_assets` keyed by (editionId, kind). Callers store via
 * `storeEditionAsset` and fetch the raw bytes via `getLatestEditionAsset`
 * for the Express route that streams them to the browser.
 *
 * The `editions.heroImageUrl` (and substack equivalent) text column
 * stores a short `/api/images/edition/:id/:kind` URL instead of an
 * inline data URL, keeps every list/get query lightweight.
 */
import { and, desc, eq } from "drizzle-orm";
import * as demoQueries from "../demo/queries";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import {
  editionAssets,
  type EditionAsset,
  type InsertEditionAsset,
} from "./schema";

export type AssetKind = "hero" | "substack";

/**
 * Insert a new asset row. Returns the row id so the caller can construct
 * a stable URL. Old rows for the same (editionId, kind) are deleted —
 * we only ever serve the latest.
 */
export async function storeEditionAsset(args: {
  editionId: number;
  kind: AssetKind;
  contentType: string;
  bytes: Buffer;
}): Promise<number> {
  if (isDemoMode()) {
    return demoQueries.storeEditionAsset?.(args) ?? 0;
  }
  const db = getDb();
  if (!db) throw new Error("storeEditionAsset: database unavailable");

  // Wipe previous rows for this slot so the table doesn't grow unbounded
  //, historical images aren't useful.
  await db
    .delete(editionAssets)
    .where(
      and(
        eq(editionAssets.editionId, args.editionId),
        eq(editionAssets.kind, args.kind)
      )
    );

  const row: InsertEditionAsset = {
    editionId: args.editionId,
    kind: args.kind,
    contentType: args.contentType,
    bytes: args.bytes,
  };
  const result = await db.insert(editionAssets).values(row);
  // mysql2 returns insertId on the first element of the result array.
  return Number((result as unknown as Array<{ insertId?: number }>)[0]?.insertId ?? 0);
}

/**
 * Fetch the most-recent asset of a given kind for an edition. The Express
 * route uses this to stream the bytes back to the browser.
 */
export async function getLatestEditionAsset(
  editionId: number,
  kind: AssetKind
): Promise<EditionAsset | null> {
  if (isDemoMode()) {
    return demoQueries.getLatestEditionAsset?.(editionId, kind) ?? null;
  }
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(editionAssets)
    .where(
      and(
        eq(editionAssets.editionId, editionId),
        eq(editionAssets.kind, kind)
      )
    )
    .orderBy(desc(editionAssets.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Build the public URL for an asset. Centralised so the Express route
 * and the image-generation pipeline agree on the format.
 */
export function editionAssetUrl(editionId: number, kind: AssetKind): string {
  return `/api/images/edition/${editionId}/${kind}`;
}
