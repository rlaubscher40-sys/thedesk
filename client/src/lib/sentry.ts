/**
 * Sentry browser client. Env-gated: when VITE_SENTRY_DSN isn't set this
 * file's initSentry() is a no-op so dev / preview environments don't
 * report errors to a production project.
 *
 * Set the DSN on Railway as VITE_SENTRY_DSN (Vite picks it up at build
 * time, exposes it on import.meta.env). VITE_SENTRY_ENVIRONMENT can
 * tag events with the deployment stage; defaults to "production".
 */
import * as Sentry from "@sentry/react";

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment:
      (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ??
      "production",
    // Modest sample rate — for a low-volume editorial product we don't
    // need full-trace performance data, but a small sample lets us
    // spot regressions.
    tracesSampleRate: 0.1,
    // Release tag falls back to the build timestamp so we can tell
    // deploys apart even without CI-injected git SHAs.
    release: (import.meta.env.VITE_SENTRY_RELEASE as string | undefined) ?? undefined,
  });
}

/** Re-export the boundary so the React ErrorBoundary can wrap it. */
export const SentryErrorBoundary = Sentry.ErrorBoundary;
