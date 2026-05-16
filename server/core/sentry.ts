/**
 * Server-side Sentry init. Env-gated on SENTRY_DSN so the absence of
 * the env var keeps the SDK quiet in dev / on Railway preview deploys.
 *
 * Called at the very top of server bootstrap so anything that throws
 * during route registration still ends up in Sentry.
 */
import * as Sentry from "@sentry/node";
import type { Express, NextFunction, Request, Response } from "express";

let initialised = false;

export function initSentry(): boolean {
  if (initialised) return true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "production",
    tracesSampleRate: 0.1,
    release: process.env.SENTRY_RELEASE,
  });
  initialised = true;
  return true;
}

/**
 * Last-resort Express handler — logs any error that escaped a tRPC
 * procedure or route handler to Sentry, then forwards a minimal error
 * response. Mount AFTER all routes.
 */
export function registerSentryErrorHandler(app: Express): void {
  if (!initialised) return;
  app.use(
    (
      err: Error,
      _req: Request,
      res: Response,
      _next: NextFunction
    ): void => {
      Sentry.captureException(err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );
}
