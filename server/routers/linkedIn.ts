/**
 * Featured LinkedIn posts.
 *
 * Public:
 *   · list — live posts in display order. Used by the "Ruben on LinkedIn"
 *            strip on the Today page.
 *
 * Admin:
 *   · listAll — full list including hidden rows. Drives the admin form.
 *   · add     — create a new featured post.
 *   · update  — patch any field (excerpt, order, isLive, etc.).
 *   · remove  — hard delete.
 */
import { z } from "zod";
import * as db from "../db";
import { adminProcedure, publicProcedure, router } from "../core/trpc";

const postUrlSchema = z
  .string()
  .url()
  .refine((u) => u.toLowerCase().includes("linkedin.com"), {
    message: "URL must be a linkedin.com link",
  });

export const linkedInRouter = router({
  list: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(20).default(6) }).optional())
    .query(async ({ input }) => {
      return db.listLiveLinkedInPosts(input?.limit ?? 6);
    }),

  listAll: adminProcedure.query(async () => {
    return db.listAllLinkedInPosts();
  }),

  add: adminProcedure
    .input(
      z.object({
        postUrl: postUrlSchema,
        excerpt: z.string().min(1).max(2000),
        authorName: z.string().min(1).max(128).optional(),
        displayOrder: z.number().int().min(0).max(9999).optional(),
        isLive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return db.createLinkedInPost({
        postUrl: input.postUrl,
        excerpt: input.excerpt,
        authorName: input.authorName ?? "Ruben Laubscher",
        displayOrder: input.displayOrder ?? 100,
        isLive: input.isLive ?? true,
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        postUrl: postUrlSchema.optional(),
        excerpt: z.string().min(1).max(2000).optional(),
        authorName: z.string().min(1).max(128).optional(),
        displayOrder: z.number().int().min(0).max(9999).optional(),
        isLive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...patch } = input;
      await db.updateLinkedInPost(id, patch);
      return { success: true } as const;
    }),

  remove: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await db.deleteLinkedInPost(input.id);
      return { success: true } as const;
    }),
});
