/**
 * Self-hosted page-view analytics endpoint. Replaces the Plausible
 * script. No cookies, no fingerprinting, no IP storage.
 *
 * The browser posts JSON to /api/analytics/pageview from its router-
 * change handler. We:
 *   1. Drop the request if the user-agent looks like a bot.
 *   2. Drop the request if the user sent DNT (do-not-track) — we
 *      respect it even though the brand-guide §11 already promised
 *      "no tracking pixels". Same spirit.
 *   3. Reduce the supplied referrer to a hostname so we never persist
 *      a full URL (which can leak query strings).
 *   4. Persist {viewedAt, path, referrer-hostname, sessionId} into
 *      page_views.
 *
 * Rate-limited per-IP at 60 events/min — a real reader navigating
 * fast sits well under this, but a misbehaving tab can't carpet-bomb
 * the table.
 */
import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import * as db from "../db";

const pageViewSchema = z.object({
  /** Path part of the URL the reader is on. Query strings stripped
   *  client-side, but defensively stripped here too. */
  path: z.string().min(1).max(256),
  /** Full referring URL or hostname, OR empty. Reduced to hostname
   *  before persistence. */
  referrer: z.string().max(2_048).optional(),
  /** sessionStorage-allocated token. Random hex string the browser
   *  generates fresh per tab; we only count distinct values within a
   *  window. */
  sessionId: z.string().min(8).max(64),
});

const BOT_UA_RE =
  /(bot|crawl|spider|crawler|preview|fetch|headless|monitor|wget|curl\b|httpie|node-fetch|axios)/i;

function looksLikeBot(ua: string | undefined): boolean {
  if (!ua) return true;
  return BOT_UA_RE.test(ua);
}

/** Reduce a referrer string to just its hostname, never the full URL. */
function reduceReferrer(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.hostname.slice(0, 256);
  } catch {
    // Already a plain hostname or garbage. Strip everything after the
    // first slash so we never persist anything path-shaped.
    const trimmed = raw.split(/[/?#]/, 1)[0]?.slice(0, 256) ?? "";
    return trimmed.length > 0 ? trimmed : null;
  }
}

/** Trim path: drop query string and fragment defensively. */
function reducePath(raw: string): string {
  return raw.split(/[?#]/, 1)[0]?.slice(0, 256) ?? "/";
}

async function handlePageView(req: Request, res: Response): Promise<void> {
  const ua = req.header("user-agent");
  const dnt = req.header("dnt");
  if (looksLikeBot(ua) || dnt === "1") {
    // 204 silently — we don't want to leak the filter rules and bots
    // get no useful info from this either way.
    res.status(204).end();
    return;
  }
  const parsed = pageViewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad page-view payload" });
    return;
  }
  // Skip the same-origin referrer — that's just internal navigation
  // and we already have the path. Caller can also pass empty.
  const refHost = reduceReferrer(parsed.data.referrer);
  const ownHost = req.header("host")?.split(":")[0] ?? null;
  const referrer = refHost && refHost !== ownHost ? refHost : null;

  await db.recordPageView({
    path: reducePath(parsed.data.path),
    referrer,
    sessionId: parsed.data.sessionId,
  });
  res.status(204).end();
}

export function registerAnalyticsRoutes(app: Express): void {
  // Tight bucket — 60/min/ip. A user opening lots of tabs in fast
  // sequence sits well under this; a noisy / buggy client can't fill
  // the table. Skip the global standardHeaders so we don't surface
  // rate-limit info to clients (no point publicising the threshold).
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: false,
    legacyHeaders: false,
    message: { error: "Too many events" },
  });
  app.post("/api/analytics/pageview", limiter, handlePageView);
}
