/**
 * Instagram posts admin router.
 *
 * Admin:
 *   · listAll          — recent posts with engagement metrics, newest first.
 *   · publishingStatus — live content-publishing quota usage from the Graph API.
 */
import { z } from "zod";
import { env } from "../core/env";
import { fetchPublishingLimit } from "../instagram/api";
import { listInstagramPosts } from "../db/instagramPosts";
import { adminProcedure, router } from "../core/trpc";

export const instagramRouter = router({
  listAll: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(30) }).optional())
    .query(async ({ input }) => {
      return listInstagramPosts(input?.limit ?? 30);
    }),

  /**
   * The account's content-publishing quota usage (Instagram's documented
   * 50-posts-per-24h limit), read live from the Graph API. Lets the admin see
   * how much of the daily allowance a run used. Degrades gracefully: not
   * configured → flagged; a failed live call → error string, never a throw.
   */
  publishingStatus: adminProcedure.query(async () => {
    const { instagramAccessToken: accessToken, instagramBusinessAccountId: igUserId } = env;
    if (!accessToken || !igUserId) {
      return {
        configured: false,
        usage: null,
        quota: null,
        windowHours: null,
        error: null as string | null,
      };
    }
    try {
      const limit = await fetchPublishingLimit({ igUserId, accessToken });
      return { configured: true, ...limit, error: null as string | null };
    } catch (err) {
      return {
        configured: true,
        usage: null,
        quota: null,
        windowHours: null,
        error: (err as Error).message.slice(0, 200),
      };
    }
  }),
});
