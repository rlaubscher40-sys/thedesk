/**
 * Admin-only health router.
 *
 * Surfaces what only the app itself can see: env-var coverage, recent
 * exceptions, uptime over a rolling window, ingest cadence (latest
 * edition publishedAt, latest daily-feed item createdAt, latest
 * metric updatedAt), subscriber pipeline state.
 *
 * External tools (Sentry, BetterStack) cover the same axes from
 * outside; this router is the inside-out complement.
 */
import { z } from "zod";
import { sql } from "drizzle-orm";
import * as db from "../db";
import { getDb } from "../db/client";
import type { Subscriber, DailyMetric } from "../db/schema";
import { adminProcedure, router } from "../core/trpc";

const envFlag = (name: string) => Boolean(process.env[name]);

/**
 * Service status vocabulary:
 *   operational    — live-verified healthy right now (DB ping ok, traffic
 *                    proxying through CF, running on Railway).
 *   configured     — required credential is present, but we don't burn a
 *                    paid request to live-check it on every poll.
 *   not_configured — an optional/required credential is missing.
 *   down           — live check ran and failed.
 *   info           — informational dependency we can't positively verify
 *                    from inside the app (e.g. no cf-ray on a direct hit).
 */
type ServiceState = "operational" | "configured" | "not_configured" | "down" | "info";

type ServiceInfo = {
  id: string;
  name: string;
  category: string;
  role: string;
  /** Required for the site to function in production. */
  required: boolean;
  state: ServiceState;
  detail: string;
  /** Provider's public status page for the live, authoritative picture. */
  statusUrl: string;
  /** Provider's dashboard/console for managing the service. */
  dashboardUrl?: string;
};

export const healthRouter = router({
  /** Headline service-health summary for the admin dashboard. */
  summary: adminProcedure.query(async () => {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [errors24h, errors7d, uptime24h, uptime7d, editions, feed, metrics, subs] =
      await Promise.all([
        db.countServerErrorsSince(dayAgo),
        db.countServerErrorsSince(weekAgo),
        db.uptimeWindowStats(24),
        db.uptimeWindowStats(24 * 7),
        db.listEditions().catch(() => []),
        db.listFeedItems().catch(() => []),
        db.listDailyMetrics().catch((): DailyMetric[] => []),
        db.listSubscribers().catch((): Subscriber[] => []),
      ]);

    const latestEdition = editions[0] ?? null;
    const latestFeedItem = feed[0] ?? null;
    const latestMetric =
      metrics
        .slice()
        .sort(
          (a: DailyMetric, b: DailyMetric) =>
            b.updatedAt.getTime() - a.updatedAt.getTime()
        )[0] ?? null;

    return {
      env: {
        anthropic: envFlag("ANTHROPIC_API_KEY"),
        openai: envFlag("OPENAI_API_KEY"),
        resend: envFlag("RESEND_API_KEY"),
        siteUrl: envFlag("SITE_URL") || envFlag("VITE_SITE_URL"),
        scheduledKey: envFlag("SCHEDULED_API_KEY"),
        database: envFlag("DATABASE_URL"),
      },
      errors: {
        last24h: errors24h,
        last7d: errors7d,
      },
      uptime: {
        last24h: {
          total: uptime24h.total,
          up: uptime24h.up,
          percent: uptime24h.total
            ? Math.round((uptime24h.up / uptime24h.total) * 1000) / 10
            : null,
          avgLatencyMs: uptime24h.avgLatencyMs,
        },
        last7d: {
          total: uptime7d.total,
          up: uptime7d.up,
          percent: uptime7d.total
            ? Math.round((uptime7d.up / uptime7d.total) * 1000) / 10
            : null,
          avgLatencyMs: uptime7d.avgLatencyMs,
        },
      },
      ingest: {
        latestEditionPublishedAt: latestEdition?.publishedAt ?? null,
        latestEditionNumber: latestEdition?.editionNumber ?? null,
        latestFeedItemAt: latestFeedItem?.createdAt ?? null,
        latestFeedItemTitle: latestFeedItem?.title ?? null,
        latestMetricAt: latestMetric?.updatedAt ?? null,
      },
      subscribers: {
        total: subs.length,
        confirmed: subs.filter(
          (s: Subscriber) => s.confirmedAt && !s.unsubscribedAt
        ).length,
        pendingConfirm: subs.filter(
          (s: Subscriber) => !s.confirmedAt && !s.unsubscribedAt
        ).length,
        unsubscribed: subs.filter((s: Subscriber) => Boolean(s.unsubscribedAt))
          .length,
      },
    };
  }),

  /**
   * Catalogue of the third-party services the site depends on, with a
   * status for each. Where the app can verify a dependency cheaply and
   * safely it does so live (a SELECT 1 against the database, the presence
   * of Railway/Cloudflare runtime signals); for the paid external APIs it
   * reports configuration state (credential present or not) rather than
   * burning a request/quota on every poll, and links out to the provider's
   * own status page for the live picture.
   */
  services: adminProcedure.query(async ({ ctx }) => {
    // ── Live database ping ────────────────────────────────────────────
    let database: { state: ServiceState; detail: string };
    const dbClient = getDb();
    if (!dbClient) {
      database = { state: "not_configured", detail: "DATABASE_URL not set" };
    } else {
      const startedAt = Date.now();
      try {
        await dbClient.execute(sql`SELECT 1`);
        database = { state: "operational", detail: `Reachable · ${Date.now() - startedAt}ms` };
      } catch (err) {
        database = { state: "down", detail: (err as Error).message.slice(0, 120) };
      }
    }

    // ── Hosting / network runtime signals ─────────────────────────────
    // Railway injects RAILWAY_* env vars into the running container; their
    // presence means we are in fact running on Railway right now.
    const railwayService = process.env.RAILWAY_SERVICE_NAME;
    const railwayEnv =
      process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.RAILWAY_ENVIRONMENT;
    const onRailway = Boolean(railwayService || railwayEnv);

    // Cloudflare stamps a `cf-ray` header (with the edge colo) on every
    // request it proxies. If we see one, traffic is flowing through CF.
    const cfRay = ctx.req?.headers?.["cf-ray"];
    const cfRayStr = Array.isArray(cfRay) ? cfRay[0] : cfRay;
    const cfColo = cfRayStr?.split("-")[1];

    const services: ServiceInfo[] = [
      {
        id: "tidb",
        name: "TiDB Serverless",
        category: "Data",
        role: "Primary MySQL-compatible database — feed, editions, subscribers, metrics, health.",
        required: true,
        state: database.state,
        detail: database.detail,
        statusUrl: "https://status.tidbcloud.com/",
        dashboardUrl: "https://tidbcloud.com/",
      },
      {
        id: "railway",
        name: "Railway",
        category: "Hosting & network",
        role: "Application hosting and runtime for the Node server.",
        required: true,
        state: onRailway ? "operational" : "info",
        detail: onRailway
          ? `Running${railwayService ? ` · ${railwayService}` : ""}${railwayEnv ? ` (${railwayEnv})` : ""}`
          : "No Railway runtime signal (may be hosted elsewhere or local)",
        statusUrl: "https://status.railway.com/",
        dashboardUrl: "https://railway.app/",
      },
      {
        id: "cloudflare",
        name: "Cloudflare",
        category: "Hosting & network",
        role: "DNS, CDN, and proxy in front of the site.",
        required: false,
        state: cfRayStr ? "operational" : "info",
        detail: cfRayStr
          ? `Proxying${cfColo ? ` · edge ${cfColo}` : ""}`
          : "No cf-ray on this request (direct hit or local)",
        statusUrl: "https://www.cloudflarestatus.com/",
        dashboardUrl: "https://dash.cloudflare.com/",
      },
      {
        id: "anthropic",
        name: "Anthropic API",
        category: "AI",
        role: "Claude LLM enrichment — say-this, why-it-matters, counterpoints, weekly synthesis, editor QC.",
        required: true,
        state: envFlag("ANTHROPIC_API_KEY") ? "configured" : "not_configured",
        detail: envFlag("ANTHROPIC_API_KEY") ? "ANTHROPIC_API_KEY set" : "ANTHROPIC_API_KEY missing",
        statusUrl: "https://status.anthropic.com/",
        dashboardUrl: "https://console.anthropic.com/",
      },
      {
        id: "openai",
        name: "OpenAI API",
        category: "AI",
        role: "Hero image generation for weekly editions. Optional — editions fall back to the image library.",
        required: false,
        state: envFlag("OPENAI_API_KEY") ? "configured" : "not_configured",
        detail: envFlag("OPENAI_API_KEY") ? "OPENAI_API_KEY set" : "OPENAI_API_KEY missing (image gen disabled)",
        statusUrl: "https://status.openai.com/",
        dashboardUrl: "https://platform.openai.com/",
      },
      {
        id: "resend",
        name: "Resend",
        category: "Email",
        role: "Transactional email — subscriber confirmations, daily brief, weekly recap, talking-point nudges.",
        required: false,
        state: envFlag("RESEND_API_KEY") ? "configured" : "not_configured",
        detail: envFlag("RESEND_API_KEY") ? "RESEND_API_KEY set" : "RESEND_API_KEY missing (emails dry-run)",
        statusUrl: "https://status.resend.com/",
        dashboardUrl: "https://resend.com/home",
      },
      {
        id: "instagram",
        name: "Instagram Graph API",
        category: "Social",
        role: "Auto-posts daily and weekly carousels to Instagram via the Meta Graph API.",
        required: false,
        state:
          envFlag("INSTAGRAM_ACCESS_TOKEN") && envFlag("INSTAGRAM_BUSINESS_ACCOUNT_ID")
            ? "configured"
            : "not_configured",
        detail:
          envFlag("INSTAGRAM_ACCESS_TOKEN") && envFlag("INSTAGRAM_BUSINESS_ACCOUNT_ID")
            ? "Token + business account ID set"
            : "Missing token and/or business account ID",
        statusUrl: "https://metastatus.com/",
        dashboardUrl: "https://developers.facebook.com/apps/",
      },
      {
        id: "github-actions",
        name: "GitHub Actions",
        category: "Automation",
        role: "Scheduled workflows — daily feed & metrics ingest, Instagram posts, uptime checks.",
        required: false,
        state: envFlag("SCHEDULED_API_KEY") ? "configured" : "not_configured",
        detail: envFlag("SCHEDULED_API_KEY")
          ? "SCHEDULED_API_KEY set — ingest endpoints authenticated"
          : "SCHEDULED_API_KEY missing — ingest endpoints fall back to admin-cookie auth only",
        statusUrl: "https://www.githubstatus.com/",
        dashboardUrl: "https://github.com/rlaubscher40-sys/thedesk/actions",
      },
    ];

    const counts = services.reduce(
      (acc, s) => {
        acc[s.state] = (acc[s.state] ?? 0) + 1;
        return acc;
      },
      {} as Record<ServiceState, number>
    );

    return { services, counts };
  }),

  /** Most recent server errors. Used to render the stack trace list. */
  recentErrors: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
    .query(async ({ input }) => {
      return db.listRecentServerErrors(input?.limit ?? 50);
    }),

  /** Raw uptime pings, newest first. Caller renders a sparkline. */
  uptimePings: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(600).default(288) }).optional())
    .query(async ({ input }) => {
      return db.listRecentUptimePings(input?.limit ?? 288);
    }),

  /** Clear the server_errors table. Useful after fixing a noisy bug. */
  clearErrors: adminProcedure.mutation(async () => {
    await db.clearServerErrors();
    return { ok: true } as const;
  }),
});
