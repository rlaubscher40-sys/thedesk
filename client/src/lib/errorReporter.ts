/**
 * Browser-side error reporter.
 *
 * Replaces the @sentry/react capture. Attaches handlers for
 * `window.error` and `window.unhandledrejection`, debounces duplicates,
 * and POSTs the report to /api/errors/client where the server persists
 * it into the same `server_errors` table the Express middleware writes
 * to. The admin /health panel renders them alongside server errors,
 * distinguished by `method === "CLIENT"`.
 *
 * Failure modes:
 *   · Network call fails → swallowed silently. Error tracking
 *     itself must never throw.
 *   · Same error fires repeatedly (e.g. inside a render loop) →
 *     deduped by message + first stack line within a 5s window so
 *     one render-loop bug doesn't carpet-bomb the log.
 */

import { clientErrorReport } from "@shared/clientErrorReport";

const DEDUPE_WINDOW_MS = 5_000;
const REPORT_WINDOW_MS = 60_000;
const MAX_REPORTS_PER_WINDOW = 10;
const recentlySent = new Map<string, number>();
let windowStarted = 0;
let reportCount = 0;
let initialized = false;

/**
 * Errors thrown by code that isn't ours — in-app browser / WebView native
 * bridges (iOS `window.webkit.messageHandlers`, injected `sendDataToNative` /
 * `sendPageHideMessage`), browser extensions, and well-known benign browser
 * quirks. They fire in the visitor's wrapper/extension, not in The Desk, so we
 * can't fix them and they only add noise to the admin error log. Matched by
 * substring against the message and stack; kept deliberately narrow so genuine
 * app errors are never swallowed.
 */
const IGNORED_ERROR_PATTERNS = [
  "webkit.messageHandlers",
  "sendDataToNative",
  "sendPageHideMessage",
  "Extension context invalidated",
  "ResizeObserver loop", // benign layout-timing warning, not a real failure
] as const;

export function isIgnorableError(message: string, stack: string | null): boolean {
  const haystack = `${message}\n${stack ?? ""}`;
  return IGNORED_ERROR_PATTERNS.some((p) => haystack.includes(p));
}

function dedupeKey(message: string, stack: string | null): string {
  const firstStackLine = stack?.split("\n").slice(0, 2).join(" ") ?? "";
  return `${message}::${firstStackLine}`;
}

function shouldSkip(key: string): boolean {
  const now = Date.now();
  // Sweep stale entries so the map doesn't grow unbounded over a long
  // session. Cheap: this only runs on error.
  for (const [k, ts] of recentlySent) {
    if (now - ts > DEDUPE_WINDOW_MS) recentlySent.delete(k);
  }
  const last = recentlySent.get(key);
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return true;
  if (now - windowStarted >= REPORT_WINDOW_MS || now < windowStarted) {
    windowStarted = now;
    reportCount = 0;
  }
  if (reportCount >= MAX_REPORTS_PER_WINDOW) return true;
  reportCount++;
  recentlySent.set(key, now);
  return false;
}

async function report(payload: {
  message: string;
  stack: string | null;
  url: string;
}): Promise<void> {
  try {
    const safe = clientErrorReport(payload);
    if (isIgnorableError(safe.message, safe.stack)) return;
    if (shouldSkip(dedupeKey(safe.message, safe.stack))) return;
    await fetch("/api/errors/client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Keepalive so the report still flies if the user is navigating
      // away when the error fired.
      keepalive: true,
      body: JSON.stringify(safe),
    });
  } catch {
    // Error reporting must never throw — this network call is
    // best-effort.
  }
}

export function initErrorReporter(): void {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;

  window.addEventListener("error", (event) => {
    const message =
      event.message || (event.error instanceof Error ? event.error.message : "Unknown error");
    const stack = event.error instanceof Error ? (event.error.stack ?? null) : null;
    if (isIgnorableError(message, stack)) return;
    void report({ message, stack, url: window.location.href });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "Unhandled promise rejection";
    const stack = reason instanceof Error ? (reason.stack ?? null) : null;
    if (isIgnorableError(message, stack)) return;
    void report({ message, stack, url: window.location.href });
  });
}

/** Explicit one-shot capture for code paths that catch an error and
 *  want it recorded (ErrorBoundary, tRPC error hooks, etc.). */
export function reportError(err: unknown, context?: { url?: string }): void {
  try {
    const e = err instanceof Error ? err : new Error(String(err));
    void report({
      message: e.message,
      stack: e.stack ?? null,
      url: context?.url ?? (typeof window !== "undefined" ? window.location.href : ""),
    });
  } catch {
    // Even unusual thrown objects/getters must not make reporting throw.
  }
}
