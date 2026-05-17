/**
 * Admin tRPC for the hero-image library — the small pool of reusable
 * editorial covers that the weekly cron cycles through instead of
 * generating fresh every Sunday.
 *
 * Everything in here is admin-only. The library never reaches end
 * users directly — they see library images embedded into edition
 * pages via the existing `editions.heroImageUrl` flow.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { generateImage } from "../core/image";
import * as db from "../db";
import { libraryHeroPrompt } from "../prompts";
import { adminProcedure, router } from "../core/trpc";

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
   * Generate a new library image and store it. The prompt is generic
   * (not tied to any single edition's content) so the result can be
   * reused across many weeks. Optional `seed` argument lets the admin
   * walk through visual variants when seeding a fresh library.
   */
  generate: adminProcedure
    .input(
      z.object({
        seed: z.number().int().optional(),
        label: z.string().max(128).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const prompt = libraryHeroPrompt({ seed: input.seed });
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

  /** Toggle the retired flag — keeps the row but excludes it from
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
   *  copy in `edition_assets` — only future picks are affected. */
  remove: adminProcedure.input(idInput).mutation(async ({ input }) => {
    await db.deleteHeroLibraryItem(input.id);
    return { success: true } as const;
  }),
});
