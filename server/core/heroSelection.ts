/**
 * Hero-image selection for weekly editions.
 *
 * Three paths, in order of preference:
 *   1. `useLibrary` (default) — pick the least-recently-used image
 *      from `hero_library`, copy its bytes to `edition_assets` for this
 *      edition, mark the library row used. Zero OpenAI calls.
 *   2. Library empty → fall back to fresh OpenAI generation. The
 *      result is ALSO seeded into the library so the next edition
 *      can reuse it.
 *   3. `forceFresh = true` (admin override for landmark editions) —
 *      skip the library entirely, generate fresh, do not seed.
 *
 * The cron flow (`scheduledRoutes.ts`) calls this with the default
 * settings. The admin "Regenerate hero" button calls it with
 * `forceFresh: true` so a landmark cover can be commissioned even when
 * the library is full.
 */
import * as db from "../db";
import { generateImage } from "./image";

export type HeroSelectionResult =
  | { ok: true; source: "library"; libraryId: number }
  | { ok: true; source: "generated"; libraryId: number | null }
  | { ok: false; reason: string };

export async function resolveHeroForEdition(args: {
  editionId: number;
  prompt: string;
  /** Skip the library and force OpenAI generation. */
  forceFresh?: boolean;
  /** When falling back to generation, also seed the library so the
   *  next edition can reuse the result. Defaults to true. */
  seedOnFallback?: boolean;
  /** Optional label to apply to a seeded library row. */
  seedLabel?: string | null;
}): Promise<HeroSelectionResult> {
  const seedOnFallback = args.seedOnFallback ?? true;

  if (!args.forceFresh) {
    const libRow = await db.pickLeastRecentlyUsedHero();
    if (libRow) {
      await db.storeEditionAsset({
        editionId: args.editionId,
        kind: "hero",
        contentType: libRow.contentType,
        bytes: libRow.bytes,
      });
      await db.markHeroLibraryUsed(libRow.id);
      return { ok: true, source: "library", libraryId: libRow.id };
    }
  }

  // Library empty (or admin forced fresh) — call OpenAI.
  const generated = await generateImage({ prompt: args.prompt });
  if (!generated) {
    return { ok: false, reason: "image generation unavailable" };
  }

  await db.storeEditionAsset({
    editionId: args.editionId,
    kind: "hero",
    contentType: generated.contentType,
    bytes: generated.bytes,
  });

  let seededId: number | null = null;
  if (seedOnFallback && !args.forceFresh) {
    // Only auto-seed when the fallback ran because the library was empty —
    // not when the admin explicitly asked for a one-off custom image.
    try {
      seededId = await db.storeHeroLibraryItem({
        label: args.seedLabel ?? "auto-seeded",
        promptUsed: args.prompt,
        contentType: generated.contentType,
        bytes: generated.bytes,
      });
    } catch (err) {
      // Seeding is best-effort. The edition image is already saved.
      console.warn(
        "[heroSelection] failed to seed library row:",
        (err as Error).message
      );
    }
  }

  return { ok: true, source: "generated", libraryId: seededId };
}
