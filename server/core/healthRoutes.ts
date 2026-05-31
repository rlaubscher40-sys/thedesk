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
import { timingSafeEqual } from "node:crypto";
import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import * as db from "../db";

const SCHEDULED_KEY_HEADER = "x-scheduled-key";

function authorised(req: Request): boolean {
  const expected = process.env.SCHEDULED_API_KEY;
  if (!expected) return false;
  const got = req.header(SCHEDULED_KEY_HEADER);
  if (typeof got !== "string" || got.length !== expected.length) return false;
  // Constant-time compare so response latency doesn't leak the key.
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
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

const clientErrorSchema = z.object({
  message: z.string().min(1).max(512),
  stack: z.string().max(8_000).nullable().optional(),
  url: z.string().max(512).optional(),
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

async function handleClientError(req: Request, res: Response): Promise<void> {
  // No auth gate — browsers POST whenever they throw. Rate-limited
  // upstream by the same /api limiter that fronts tRPC. Schema is
  // strict and the row is bounded, so abuse just fills the ring
  // buffer (admin can clear from /admin).
  const parsed = clientErrorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad client-error payload" });
    return;
  }
  await db.recordServerError({
    level: "error",
    message: parsed.data.message,
    stack: parsed.data.stack ?? null,
    // Encode as a client-side error by stashing "CLIENT" in the
    // method slot. The admin /health panel keys off this to label
    // the row distinctly without needing a schema migration.
    method: "CLIENT",
    route: parsed.data.url ?? null,
    statusCode: null,
    userAgent: req.header("user-agent")?.slice(0, 256) ?? null,
  });
  // 204 No Content — caller ignores the body anyway.
  res.status(204).end();
}

export function registerHealthRoutes(app: Express): void {
  app.get("/api/healthz", handleHealthz);
  app.post("/api/uptime/record", handleRecordPing);
  app.post("/api/errors/client", handleClientError);
}
