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

const pageViewSchema = z.object({
  path: z.string().min(1).max(256),
  referrer: z.string().max(2_048).optional(),
  sessionId: z.string().min(8).max(64),
});

const engagementEventSchema = z.object({
  event: z.enum([
    "ask_query",
    "ask_share",
    "market_watch",
    "market_discover",
    "market_file_ask",
    "market_file_compare",
    "market_file_source",
    "market_file_share",
    "market_file_export",
    "market_compare",
    "market_compare_share",
    "comparison_watch",
    "comparison_refresh",
    "comparison_baseline_reset",
    "signal_watch",
    "signal_share",
    "story_share",
    "take_share",
    "brief_reshare",
  ]),
  surface: z.enum(["ask", "markets", "signals", "trends", "story", "brief", "today"]).optional(),
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

/** Reduce a referrer string to just its hostname, never the full URL. */
function reduceReferrer(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.hostname.slice(0, 256);
  } catch {
    const trimmed = raw.split(/[/?#]/, 1)[0]?.slice(0, 256) ?? "";
    return trimmed.length > 0 ? trimmed : null;
  }
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
  const refHost = reduceReferrer(parsed.data.referrer);
  const ownHost = hostnameOnly(req.header("host"));
  const referrer = refHost && refHost !== ownHost ? refHost : null;

  await db.recordPageView({
    path: analyticsPath(parsed.data.path),
    referrer,
    sessionId: parsed.data.sessionId,
  });
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
  app.post("/api/analytics/pageview", limiter, handlePageView);
  app.post("/api/analytics/event", limiter, handleEngagementEvent);
}
