/**
 * Auth routes.
 *
 *   POST /api/auth/login   { password }  → sets signed JWT cookie
 *   POST /api/auth/logout                → clears the cookie
 *
 * No OAuth, no provider hand-off. The single admin (you) authenticates
 * against the `ADMIN_PASSWORD` env var.
 */
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import { getSessionCookieOptions } from "./cookies";
import { env } from "./env";
import { sdk } from "./sdk";

export function registerOAuthRoutes(app: Express): void {
  /**
   * Quick "is admin login wired up?" probe. Returns flags only — never
   * leaks the password value. Useful when login fails and we need to
   * tell config-missing apart from wrong-password from the phone.
   */
  app.get("/api/auth/status", (_req: Request, res: Response) => {
    res.json({
      passwordConfigured: env.adminPassword.length > 0,
      jwtSecretConfigured: env.cookieSecret.length > 0,
      environment: env.isProduction ? "production" : "development",
    });
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!password) {
      res.status(400).json({ error: "Password is required" });
      return;
    }
    // Distinguish "server isn't configured" from "wrong password". The
    // first is a config bug worth surfacing; the second is normal.
    if (env.adminPassword.length === 0) {
      res
        .status(503)
        .json({
          error:
            "Admin login isn't configured. Set the ADMIN_PASSWORD env var on the server and redeploy.",
        });
      return;
    }
    if (env.cookieSecret.length === 0) {
      res
        .status(503)
        .json({
          error:
            "Session signing key isn't configured. Set the JWT_SECRET env var on the server and redeploy.",
        });
      return;
    }
    if (!sdk.verifyPassword(password)) {
      res.status(401).json({ error: "Invalid password" });
      return;
    }
    const token = await sdk.createSessionToken({ expiresInMs: ONE_YEAR_MS });
    res.cookie(COOKIE_NAME, token, {
      ...getSessionCookieOptions(req),
      maxAge: ONE_YEAR_MS,
    });
    res.json({ success: true });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
    res.json({ success: true });
  });
}
