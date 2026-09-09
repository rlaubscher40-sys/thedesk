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
import { fetchPublishingLimit, isTransientServerError } from "../instagram/api";
import { listInstagramPosts } from "../db/instagramPosts";
import { adminProcedure, publicProcedure, router } from "../core/trpc";
import { cached } from "../core/cache";
import { publishedSocialStories } from "../instagram/publishedStories";
import { LAUNCH_POST_IDS } from "../../shared/instagramLaunch";
import { launchPostStatus, previewLaunchPost, publishLaunchPost } from "../instagram/launch";

/** The ingest endpoint behind each re-runnable posting job. */
const RERUN_PATHS = {
  daily: "/api/ingest/instagram-daily",
  coverage: "/api/ingest/instagram-coverage",
  stat: "/api/ingest/instagram-stat",
  reel: "/api/ingest/instagram-reel",
  monthly: "/api/ingest/instagram-monthly",
  weekly: "/api/ingest/instagram-weekly",
} as const;

type RerunResponse = {
  success?: boolean;
  postId?: string;
  headline?: string;
  recovered?: boolean;
  editionNumber?: number;
  /** The Number returns this on a day when no metric was worth a card. */
  skipped?: boolean;
  reason?: string;
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
  publishedStories: publicProcedure.query(() =>
    cached("social:published-stories", 60_000, () => publishedSocialStories())
  ),
  launchStatus: adminProcedure.query(() => launchPostStatus()),
  launchPreview: adminProcedure
    .input(z.object({ id: z.enum(LAUNCH_POST_IDS) }).strict())
    .query(({ input }) => previewLaunchPost(input.id)),
  launchPublish: adminProcedure
    .input(
      z
        .object({
          id: z.enum(LAUNCH_POST_IDS),
          contentHash: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .strict()
    )
    .mutation(({ input }) => publishLaunchPost(input.id, input.contentHash)),

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
  /**
   * Whether a Reel could be made right now. Surfaced next to the publishing
   * quota because the two questions an admin has before a posting window are
   * "am I allowed to post" and "will the post render".
   */
  reelReadiness: adminProcedure.query(async () => {
    const { checkReelReadiness } = await import("../video/preflight");
    return checkReelReadiness();
  }),

  reelPlan: adminProcedure.query(async () => {
    const { readReelAutomation, REEL_SCHEDULE } = await import("../instagram/reelAutomation");
    const { latestGridCoverVariant } = await import("../db/instagramPosts");
    const plan = await readReelAutomation();
    const { getVerifiedReelProgramme } = await import("../instagram/reelCandidates");
    const { reelPublicationRecord } = await import("../instagram/reelStatus");
    const programme = await getVerifiedReelProgramme();
    const editorialQueue = await Promise.all(
      programme.map(async (entry) => ({
        topic: entry.topic,
        status: entry.candidate
          ? (await reelPublicationRecord(entry.candidate.publication)).state
          : "no-evidence",
        requirement: entry.requirement,
        referenceMonth: entry.candidate?.publication.date.slice(0, 7) ?? null,
        hook: entry.candidate?.script[0]?.text ?? null,
        selected: entry.candidate?.evidenceHash === plan.candidate?.evidenceHash,
      }))
    );
    return {
      editorialQueue,
      script: plan.candidate?.script ?? null,
      schedulerEnabled: env.enableScheduler && Boolean(env.scheduledApiKey),
      accountConfigured: Boolean(env.instagramAccessToken && env.instagramBusinessAccountId),
      schedule: REEL_SCHEDULE,
      variant: (await latestGridCoverVariant()) === "navy" ? ("light" as const) : ("navy" as const),
      caption: plan.candidate?.caption ?? null,
      publication: plan.state,
      postId: "postId" in plan ? plan.postId : null,
      lastAttempt: "attempt" in plan ? (plan.attempt?.startedAt ?? null) : null,
      detail: "attempt" in plan ? (plan.attempt?.detail ?? null) : null,
      retryAt: "retryAt" in plan ? plan.retryAt : null,
    };
  }),

  publishingStatus: adminProcedure.query(async () => {
    const { instagramAccessToken: accessToken, instagramBusinessAccountId: igUserId } = env;
    if (!accessToken || !igUserId) {
      return {
        configured: false,
        usage: null,
        quota: null,
        windowHours: null,
        error: null as string | null,
        transient: false,
      };
    }
    try {
      const limit = await fetchPublishingLimit({ igUserId, accessToken });
      return { configured: true, ...limit, error: null as string | null, transient: false };
    } catch (err) {
      return {
        configured: true,
        usage: null,
        quota: null,
        windowHours: null,
        error: (err as Error).message.slice(0, 200),
        /**
         * A Meta-side blip rather than anything wrong here. Flagged so the panel
         * can say so in plain words instead of printing Graph API JSON at the
         * reader, who can do nothing about it and shouldn't be alarmed by it.
         */
        transient: isTransientServerError(err),
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
        job: z.enum(["daily", "coverage", "stat", "reel", "monthly", "weekly"]),
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
        /**
         * True when the job ran fine and deliberately published nothing — only
         * The Number does this, on a day when no metric cleared the bar. A 200
         * with no postId is a success, but reporting it as "Posted" would send
         * the admin looking for a card that was never meant to exist.
         *
         * A hand press does NOT force past this. If the day's numbers are dull,
         * the honest outcome is no post: forcing one would put exactly the kind
         * of filler on the grid that taking the format seriously is meant to
         * avoid.
         */
        skipped: parsed.skipped === true,
        reason: parsed.reason ?? null,
      };
    }),
});
