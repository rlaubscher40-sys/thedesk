/**
 * The server's own base URL, for the few places that legitimately call our own
 * HTTP endpoints: the scheduler's daily job runs, and the admin panel's
 * "re-run this job" buttons.
 *
 * Recorded from the port we actually bound, NOT read back out of PORT. In
 * development the boot sequence may hop to a neighbouring port when tsx watch
 * is still holding the configured one, and a self-call aimed at the configured
 * port would then hit nothing (or, worse, the dying old process).
 *
 * Unset until the server has bound — callers must handle null rather than
 * assume a URL, since anything importing this during module init runs before
 * `listen`.
 */
let baseUrl: string | null = null;

/** Called once from the `listen` callback with the port actually bound. */
export function setLoopbackBaseUrl(port: number): void {
  baseUrl = `http://127.0.0.1:${port}`;
}

/** The loopback base URL, or null before the server has bound a port. */
export function loopbackBaseUrl(): string | null {
  return baseUrl;
}
