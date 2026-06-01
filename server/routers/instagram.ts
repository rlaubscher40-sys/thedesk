/**
 * Instagram posts admin router.
 *
 * Admin:
 *   · listAll — recent posts with engagement metrics, newest first.
 */
import { z } from "zod";
import { listInstagramPosts } from "../db/instagramPosts";
import { adminProcedure, router } from "../core/trpc";

export const instagramRouter = router({
  listAll: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(30) }).optional())
    .query(async ({ input }) => {
      return listInstagramPosts(input?.limit ?? 30);
    }),
});
