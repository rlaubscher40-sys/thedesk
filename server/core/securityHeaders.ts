/**
 * Security response headers, applied in production only.
 *
 * Hand-rolled rather than pulling in `helmet`: the default helmet CSP
 * blocks inline styles, Google Fonts, framer-motion's injected styles and
 * the inline theme/JSON-LD scripts this app ships, so it would need a
 * custom policy regardless. A small explicit middleware keeps the policy
 * visible and avoids adding a dependency in the same breath as hardening
 * the supply chain.
 *
 * Skipped outside production so Vite's dev server and HMR (which rely on
 * eval + websockets + inline injection) are untouched.
 *
 * The CSP is tuned to exactly what the client loads:
 *   · scripts  — own bundle + the inline theme guard and JSON-LD in
 *                index.html ('unsafe-inline'; no nonce pipeline yet)
 *   · styles   — Tailwind, framer-motion, the boot-splash <style>, and
 *                the Google Fonts stylesheet
 *   · fonts    — self + Google Fonts CDN
 *   · images   — self, data: URIs, and arbitrary https (feed-item and
 *                hero thumbnails come from external outlets)
 *   · connect  — same-origin only (tRPC + the analytics beacon)
 */
import type { Express, NextFunction, Request, Response } from "express";

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https:",
  "connect-src 'self'",
].join("; ");

export function registerSecurityHeaders(app: Express): void {
  if (process.env.NODE_ENV !== "production") return;

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Content-Security-Policy", CSP);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    // HSTS only once we know the hop reached us over TLS (Railway
    // terminates TLS at its proxy and sets x-forwarded-proto). Avoids
    // pinning HSTS during any plain-HTTP health probe.
    const proto = req.headers["x-forwarded-proto"];
    const isHttps =
      req.secure ||
      (typeof proto === "string" && proto.split(",")[0]?.trim() === "https");
    if (isHttps) {
      res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }
    next();
  });
}
