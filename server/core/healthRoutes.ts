/**
 * Health + error-tracking routes.
 *
 * Three endpoints registered here:
 *   · GET  /api/healthz  — public, lightweight liveness check used by
 *                          the external uptime cron. Returns 200 with
 *                          a small JSON body when the DB and basic
 *                          deps respond.
 *   · POST /api/uptime/record — admin-key-gated; the cron posts each
 *                               ping's status + latency back so the
 *                               admin /health page can render uptime
 *                               history without an external dashboard.
 *
 * Plus an Express error middleware (`recordExpressError`) that writes
 * uncaught route errors into the `serverErrors` table before letting
 * the existing Sentry / SPA-fallback chain do its thing.
 */
import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import * as db from "../db";

const SCHEDULED_KEY_HEADER = "x-scheduled-key";

function authorised(req: Request): boolean {
  const expected = process.env.SCHEDULED_API_KEY;
  if (!expected) return false;
  const got = req.header(SCHEDULED_KEY_HEADER);
  return typeof got === "string" && got.length > 0 && got === expected;
}

async function handleHealthz(_req: Request, res: Response): Promise<void> {
  // Public — no auth gate. Body is intentionally tiny so it's safe to
  // hit at high frequency.
  const startedAt = Date.now();
  let dbOk = false;
  try {
    // Cheap probe: list the most recent uptime ping. Demo mode and
    // real DB both work; failure means the DB layer is broken.
    await db.listRecentUptimePings(1);
    dbOk = true;
  } catch {
    dbOk = false;
  }
  res.set("Cache-Control", "no-store");
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? "ok" : "degraded",
    db: dbOk,
    uptime: Math.round(process.uptime()),
    nodeVersion: process.version,
    pid: process.pid,
    checkedInMs: Date.now() - startedAt,
  });
}

const recordPingSchema = z.object({
  statusCode: z.number().int().min(0).max(999),
  latencyMs: z.number().int().min(0).max(120_000),
  source: z.string().min(1).max(64).default("external"),
  region: z.string().max(32).optional(),
});

async function handleRecordPing(req: Request, res: Response): Promise<void> {
  if (!authorised(req)) {
    res.status(401).send("Unauthorised");
    return;
  }
  const parsed = recordPingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad ping payload", issues: parsed.error.issues });
    return;
  }
  await db.recordUptimePing({
    statusCode: parsed.data.statusCode,
    latencyMs: parsed.data.latencyMs,
    source: parsed.data.source,
    region: parsed.data.region ?? null,
  });
  res.json({ ok: true });
}

/**
 * Last in the Express middleware chain (before the Sentry handler).
 * Writes the error to `serverErrors` and then re-throws via next()
 * so Sentry — when configured — still sees it. When Sentry isn't
 * configured, the internal log is the only record.
 */
export function recordExpressError(
  err: unknown,
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const e = err instanceof Error ? err : new Error(String(err));
  // Express attaches the matched route on req.route when one exists;
  // otherwise fall back to the originalUrl path (no query string).
  const route =
    (req.route?.path as string | undefined) ??
    req.originalUrl.split("?")[0] ??
    null;
  const message = e.message.split("\n")[0]?.slice(0, 512) ?? "unknown error";
  void db
    .recordServerError({
      level: "error",
      message,
      stack: e.stack ?? null,
      method: req.method ?? null,
      route,
      statusCode: null,
      userAgent: req.header("user-agent")?.slice(0, 256) ?? null,
    })
    .catch((logErr) => {
      console.warn(
        `[health] error-logger failed to persist: ${(logErr as Error).message}`
      );
    });
  next(err);
}

export function registerHealthRoutes(app: Express): void {
  app.get("/api/healthz", handleHealthz);
  app.post("/api/uptime/record", handleRecordPing);
}
