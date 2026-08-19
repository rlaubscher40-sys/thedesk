/**
 * Instagram posts admin router.
 *
 * Admin:
 *   · listAll          — recent posts with engagement metrics, newest first.
 *   · publishingStatus — live content-publishing quota usage from the Graph API.
 *   · rerun            — fire one of the posting jobs by hand.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { env } from "../core/env";
import { loopbackBaseUrl } from "../core/loopback";
import { fetchPublishingLimit } from "../instagram/api";
import { listInstagramPosts } from "../db/instagramPosts";
import { adminProcedure, router } from "../core/trpc";

/** The ingest endpoint behind each re-runnable posting job. */
const RERUN_PATHS = {
  daily: "/api/ingest/instagram-daily",
  coverage: "/api/ingest/instagram-coverage",
  weekly: "/api/ingest/instagram-weekly",
} as const;

type RerunResponse = {
  success?: boolean;
  postId?: string;
  headline?: string;
  recovered?: boolean;
  editionNumber?: number;
  error?: string;
  message?: string;
};

/** Best sentence we can show the admin from a non-2xx ingest response. */
function describeFailure(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as RerunResponse;
    const detail = parsed.message ?? parsed.error;
    if (detail) return detail;
  } catch {
    // Not JSON (a proxy error page, say) — fall through to the raw body.
  }
  return body.trim() ? `HTTP ${status}: ${body.slice(0, 300)}` : `HTTP ${status}`;
}

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

  /**
   * Re-run a posting job by hand — the affordance the failure alert email asks
   * for ("re-run by hand once fixed"), which until now meant a curl with the
   * scheduled key or a GitHub Actions dispatch from a desktop.
   *
   * Drives the same loopback endpoint the scheduler does rather than calling
   * the posting flow directly, so the button does exactly what the cron does:
   * same story selection, same cover alternation, same recording, same error
   * reporting. It deliberately runs to completion instead of returning a
   * "queued" 200 — a post that silently fails is the failure mode this whole
   * area keeps relearning — so expect it to take up to a couple of minutes.
   *
   * Sends attempt=1: a hand re-run is a fresh decision by someone who has
   * looked at the grid, not a scheduler retry, so it should post rather than
   * consult the duplicate guard. The confirmation prompt in the admin panel is
   * what stands between a click and a second post.
   */
  rerun: adminProcedure
    .input(
      z.object({
        job: z.enum(["daily", "coverage", "weekly"]),
        /** Daily/coverage only: post a specific feed date instead of today's. */
        feedDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const base = loopbackBaseUrl();
      if (!base) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Server hasn't finished starting up — try again in a moment.",
        });
      }
      if (!env.scheduledApiKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "SCHEDULED_API_KEY isn't set, so the server can't authenticate its own re-run.",
        });
      }

      const body: Record<string, unknown> = { attempt: 1 };
      if (input.feedDate && input.job !== "weekly") body.feedDate = input.feedDate;

      let res: Response;
      try {
        res = await fetch(`${base}${RERUN_PATHS[input.job]}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-scheduled-key": env.scheduledApiKey,
          },
          body: JSON.stringify(body),
        });
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Couldn't reach the ingest endpoint: ${(err as Error).message}`,
        });
      }

      const text = await res.text().catch(() => "");
      if (!res.ok) {
        // The ingest route has already logged this to the admin error log with
        // a stack; surface the message so the admin doesn't have to go looking.
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: describeFailure(res.status, text),
        });
      }

      const parsed = JSON.parse(text) as RerunResponse;
      return {
        job: input.job,
        postId: parsed.postId ?? null,
        headline: parsed.headline ?? null,
        editionNumber: parsed.editionNumber ?? null,
        /** True when the post was already live and we recorded it rather than reposting. */
        recovered: parsed.recovered === true,
      };
    }),
});
