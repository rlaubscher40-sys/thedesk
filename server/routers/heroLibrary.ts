/**
 * Admin tRPC for the hero-image library, the small pool of reusable
 * editorial covers that the weekly cron cycles through instead of
 * generating fresh every Sunday.
 *
 * Most procedures here are admin-only. The one public exception is
 * `pickForSeed`, which the daily-feed lead card uses as a fallback
 * when a story has no og:image, same library, different surface.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { generateImage } from "../core/image";
import * as db from "../db";
import { libraryHeroPrompt } from "../prompts";
import { adminProcedure, publicProcedure, router } from "../core/trpc";

const idInput = z.object({ id: z.number().int().positive() });

export const heroLibraryRouter = router({
  /** List every library row (no bytes) for the admin grid. */
  list: adminProcedure.query(async () => {
    const items = await db.listHeroLibrary();
    return items.map((item) => ({
      ...item,
      url: db.heroLibraryUrl(item.id),
    }));
  }),

  /**
   * Public: deterministic library pick keyed by a numeric seed
   * (typically the feed item ID). Same seed always returns the same
   * image so a lead card doesn't flicker between different fallbacks
   * across re-renders or sessions.
   *
   * Excludes the most-recently-used library image from the pool —
   * that's almost certainly the one currently on the latest weekly
   * edition (the cron picks LRU and bumps `lastUsedAt`). Without this
   * exclusion the Today lead and the live edition can land on the
   * same cover at the same time, which reads as a duplicate.
   *
   * Returns `{ url: null }` when the library is empty or every row
   * is retired, the caller then renders its own fallback chrome.
   */
  pickForSeed: publicProcedure
    .input(z.object({ seed: z.number().int() }))
    .query(async ({ input }) => {
      const items = await db.listHeroLibrary();
      const active = items.filter((it) => !it.retired);
      if (active.length === 0) return { url: null as string | null };
      // Single-image library: no choice but to reuse it.
      let pool = active;
      if (active.length > 1) {
        // Sort by lastUsedAt DESC, drop the top one — that's the
        // current edition's cover. Nulls (never used) sort last under
        // DESC so they stay in the pool.
        const sorted = [...active].sort((a, b) => {
          const ta = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
          const tb = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
          return tb - ta;
        });
        pool = sorted.slice(1);
      }
      const idx = Math.abs(input.seed) % pool.length;
      const picked = pool[idx];
      if (!picked) return { url: null as string | null };
      return { url: db.heroLibraryUrl(picked.id) };
    }),

  /**
   * Generate a new library image and store it. The prompt is generic
   * (not tied to any single edition's content) so the result can be
   * reused across many weeks.
   *
   * When the admin clicks "Generate" without a specific seed, we walk
   * the seed pool in sequence based on the current library size — so
   * back-to-back clicks roll through different visual subjects rather
   * than getting unlucky with Math.random() and producing five
   * near-identical covers.
   */
  generate: adminProcedure
    .input(
      z.object({
        seed: z.number().int().optional(),
        label: z.string().max(128).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const seed =
        typeof input.seed === "number"
          ? input.seed
          : (await db.listHeroLibrary()).length;
      const prompt = libraryHeroPrompt({ seed });
      const result = await generateImage({ prompt });
      if (!result) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Image generation is not configured. Set OPENAI_API_KEY to enable.",
        });
      }
      const id = await db.storeHeroLibraryItem({
        label: input.label ?? null,
        promptUsed: prompt,
        contentType: result.contentType,
        bytes: result.bytes,
      });
      return { id, url: db.heroLibraryUrl(id) };
    }),

  /** Toggle the retired flag, keeps the row but excludes it from
   *  the rotation. Reversible via the same endpoint. */
  setRetired: adminProcedure
    .input(idInput.extend({ retired: z.boolean() }))
    .mutation(async ({ input }) => {
      await db.setHeroLibraryRetired(input.id, input.retired);
      return { success: true } as const;
    }),

  /** Rename / re-tag a library image. */
  setLabel: adminProcedure
    .input(idInput.extend({ label: z.string().max(128).nullable() }))
    .mutation(async ({ input }) => {
      await db.setHeroLibraryLabel(input.id, input.label);
      return { success: true } as const;
    }),

  /** Hard delete a row. Existing editions that used it keep their
   *  copy in `edition_assets`, only future picks are affected. */
  remove: adminProcedure.input(idInput).mutation(async ({ input }) => {
    await db.deleteHeroLibraryItem(input.id);
    return { success: true } as const;
  }),
});
