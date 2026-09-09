/**
 * Canonical-address 301s.
 *
 * The app answers on more than one URL for the same page. DEPLOY.md tells
 * you to point both `thedesk.au` and `www.thedesk.au` at Railway, and TLS
 * is terminated at the proxy so a plain-http hop reaches us too. Serving a
 * 200 on every variant splits ranking signals across duplicate URLs —
 * Search Console reports the extras as "Alternative page with proper
 * canonical tag", and the SPA's client-side canonical only lands once the
 * bundle has run, which is far later than a crawler decides. A 301 settles
 * it before any HTML is parsed.
 *
 * Three normalisations:
 *   · www.thedesk.au → thedesk.au   (whichever host SITE_URL names wins)
 *   · http:// → https://            (via x-forwarded-proto)
 *   · /path/ → /path                (trailing slash, root excluded)
 *
 * Deliberately narrow about which hosts it rewrites: only the canonical
 * host and its `www.` twin. An arbitrary Host is left alone so Railway's
 * own `*.up.railway.app` name and a `staging.thedesk.au` deploy keep
 * working instead of bouncing visitors onto production. And the target is
 * always rebuilt from SITE_URL, never echoed from the request — see the
 * note in siteUrl.ts.
 *
 * `/api/` is exempt: those are fetch/webhook/OAuth-callback endpoints where
 * a cross-host bounce drops the request body or the session cookie, and no
 * crawler indexes them anyway.
 */
import type { Express, NextFunction, Request, Response } from "express";
import { siteHost, siteUrl } from "./siteUrl";

export interface CanonicalRequest {
  method: string;
  /** Raw Host header (may carry a port). */
  host: string | undefined;
  /** x-forwarded-proto, or "https" when the socket itself was TLS. */
  proto: string | undefined;
  /** Path + query, as express gives it on req.originalUrl. */
  originalUrl: string;
}

/**
 * Where this request should be sent, or null when it's already canonical.
 *
 * Returns an absolute URL when the host or scheme is wrong and a
 * path-relative one for a pure trailing-slash fix, so the slash rule
 * applies on every host without dragging a staging visitor to production.
 */
export function canonicalRedirectFor(
  req: CanonicalRequest,
  site = siteUrl(),
  canonicalHost = siteHost()
): string | null {
  if (req.method !== "GET" && req.method !== "HEAD") return null;

  // Only origin-form paths: browsers interpret // and backslashes as hosts.
  if (
    !req.originalUrl.startsWith("/") ||
    req.originalUrl.startsWith("//") ||
    /[\\\x00-\x20\x7f]/.test(req.originalUrl)
  )
    return null;

  const [rawPath = "/", ...rest] = req.originalUrl.split("?");
  const query = rest.length > 0 ? `?${rest.join("?")}` : "";
  if (rawPath.startsWith("/api/")) return null;

  // Collapse a trailing slash on everything but the root. "/about/" and
  // "/about" render the same page, so one of them has to be the address.
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") || "/" : rawPath;

  const host = (req.host ?? "").toLowerCase().split(":")[0] ?? "";
  const onCanonicalFamily = host === canonicalHost || host === `www.${canonicalHost}`;
  // A comma-separated x-forwarded-proto means several proxy hops; the
  // first entry is the one the browser actually spoke.
  const scheme = (req.proto ?? "").toLowerCase().split(",")[0]?.trim();

  if (onCanonicalFamily) {
    const wrongHost = host !== canonicalHost;
    const wrongScheme = scheme === "http";
    if (wrongHost || wrongScheme) return `${site}${path}${query}`;
  }

  if (path !== rawPath) return `${path}${query}`;
  return null;
}

/** Parse once, check the trusted origin, and emit the validated representation. */
export function validatedCanonicalTarget(target: string, site = siteUrl()): string | null {
  try {
    const base = new URL(site);
    if (!["https:", "http:"].includes(base.protocol)) return null;
    const destination = new URL(target, base);
    if (destination.origin !== base.origin) return null;
    const normalized = destination.href;
    // The slash after the complete origin is a boundary: a lookalike host
    // or user-info prefix cannot pass. Derive the output from this value.
    if (!normalized.startsWith(`${base.origin}/`)) return null;
    if (!target.startsWith("/")) return normalized;
    const relative = normalized.slice(base.origin.length);
    // Dot-segment normalization can reveal // even in an origin-form input.
    if (relative.startsWith("//")) return null;
    return relative;
  } catch {
    return null;
  }
}

export function registerCanonicalRedirects(app: Express): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const target = canonicalRedirectFor({
      method: req.method,
      host: req.headers.host,
      proto: req.secure ? "https" : (req.headers["x-forwarded-proto"] as string | undefined),
      originalUrl: req.originalUrl,
    });
    if (!target) return next();
    const validated = validatedCanonicalTarget(target);
    if (!validated) return next();
    // Permanent address change, with relative slash fixes preserved on staging.
    res.redirect(301, validated);
  });
}
