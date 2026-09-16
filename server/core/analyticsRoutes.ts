import { webVitalSchema } from "../../shared/webVitals";
import { recordWebVital } from "../db/webVitals";
/**
 * Self-hosted analytics endpoints. No cookies, fingerprinting or IP storage.
 *
 * Page views record path + ephemeral session id + hostname-only referrer.
 * Engagement events use a strict allow-list of product actions and fixed
 * surfaces; no user-entered question, market, story or metric content is
 * accepted. Both respect DNT and bot filtering.
 */
import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import * as db from "../db";
import { analyticsPath } from "../../shared/analyticsPath";
import { SOCIAL_CAMPAIGNS } from "../../shared/socialCampaign";
import { ENGAGEMENT_EVENTS, ENGAGEMENT_SURFACES } from "../../shared/analyticsEvents";
import { analyticsReferrer } from "../../shared/analyticsReferrer";

const pageViewSchema = z.object({
  socialCampaign: z.enum(SOCIAL_CAMPAIGNS).optional(),
  isLanding: z.boolean().optional(),
  path: z.string().min(1).max(256),
  referrer: z.string().max(2_048).optional(),
  /** Campaign slug for this session, already whitelisted and slugged by
   *  client/src/lib/attribution. Constrained to a slug here too rather than
   *  trusted: this is a public, unauthenticated endpoint, so the shape has to
   *  be enforced server-side or a crafted body reaches the column. */
  campaign: z
    .string()
    .max(64)
    .regex(/^[a-z0-9._-]*$/)
    .optional(),
  sessionId: z.string().min(8).max(64),
});

const engagementEventSchema = z.object({
  event: z.enum(ENGAGEMENT_EVENTS),
  surface: z.enum(ENGAGEMENT_SURFACES).optional(),
  socialCampaign: z.enum(SOCIAL_CAMPAIGNS).optional(),
  sessionId: z.string().min(8).max(64),
});

const BOT_UA_RE =
  /(bot|crawl|spider|crawler|preview|fetch|headless|monitor|wget|curl\b|httpie|node-fetch|axios)/i;

function looksLikeBot(ua: string | undefined): boolean {
  if (!ua) return true;
  return BOT_UA_RE.test(ua);
}

function analyticsBlocked(req: Request): boolean {
  return looksLikeBot(req.header("user-agent")) || req.header("dnt") === "1";
}

/** Hostname from a Host header, dropping the port. Handles bracketed IPv6. */
function hostnameOnly(host: string | undefined): string | null {
  if (!host) return null;
  const ipv6 = host.match(/^\[(.+?)\]/);
  if (ipv6?.[1]) return ipv6[1];
  return host.split(":")[0] ?? null;
}

async function handlePageView(req: Request, res: Response): Promise<void> {
  if (analyticsBlocked(req)) {
    res.status(204).end();
    return;
  }
  const parsed = pageViewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad page-view payload" });
    return;
  }
  const refHost = analyticsReferrer(parsed.data.referrer);
  const ownHost = hostnameOnly(req.header("host"));
  const referrer = refHost && refHost !== ownHost ? refHost : null;

  await db.recordPageView({
    path: analyticsPath(parsed.data.path),
    referrer,
    // "internal" and "direct" are the absence of a campaign, not campaigns.
    // Storing them would put the two largest buckets on the site into a column
    // that exists to surface the small tagged ones.
    campaign:
      parsed.data.campaign && !["internal", "direct"].includes(parsed.data.campaign)
        ? parsed.data.campaign
        : null,
    sessionId: parsed.data.sessionId,
  });
  if (parsed.data.campaign === "instagram" && parsed.data.socialCampaign && parsed.data.isLanding) {
    await db.recordEngagementEvent({
      event: "social_landing",
      sessionId: parsed.data.sessionId,
      socialCampaign: parsed.data.socialCampaign,
    });
  }
  res.status(204).end();
}

async function handleEngagementEvent(req: Request, res: Response): Promise<void> {
  if (analyticsBlocked(req)) {
    res.status(204).end();
    return;
  }
  const parsed = engagementEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad engagement payload" });
    return;
  }
  await db.recordEngagementEvent({
    event: parsed.data.event,
    surface: parsed.data.surface ?? null,
    sessionId: parsed.data.sessionId,
    socialCampaign: parsed.data.socialCampaign,
  });
  res.status(204).end();
}

export function registerAnalyticsRoutes(app: Express): void {
  // One quiet shared budget for self-hosted analytics. Product actions are
  // sparse relative to page views, so 60/min/IP is still generous for humans.
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: false,
    legacyHeaders: false,
    message: { error: "Too many events" },
  });
  app.post("/api/analytics/vitals", limiter, async (req, res) => {
    if (analyticsBlocked(req)) {
      res.status(204).end();
      return;
    }
    const parsed = webVitalSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid performance observation" });
      return;
    }
    try {
      await recordWebVital(parsed.data);
    } catch {
      /* Telemetry cannot break reading. */
    }
    res.status(204).end();
  });
  app.post("/api/analytics/pageview", limiter, handlePageView);
  app.post("/api/analytics/event", limiter, handleEngagementEvent);
}
