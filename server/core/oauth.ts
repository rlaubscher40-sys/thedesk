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
import { COOKIE_NAME, SESSION_TTL_MS } from "../../shared/const";
import { getSessionCookieOptions } from "./cookies";
import { env } from "./env";
import { sdk } from "./sdk";

export function registerOAuthRoutes(app: Express): void {
  /**
   * Quick "is the server wired up?" probe. Returns config flags only —
   * never leaks any secret values. Useful when something fails on
   * Railway and we need to tell "env var missing" apart from "env var
   * set but value wrong" from the phone.
   */
  app.get("/api/auth/status", (_req: Request, res: Response) => {
    res.json({
      passwordConfigured: env.adminPassword.length > 0,
      jwtSecretConfigured: env.cookieSecret.length > 0,
      anthropicConfigured: env.anthropicApiKey.length > 0,
      openAiConfigured: env.openAiApiKey.length > 0,
      databaseConfigured: env.databaseUrl.length > 0,
      scheduledKeyConfigured: env.scheduledApiKey.length > 0,
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
    const token = await sdk.createSessionToken({ expiresInMs: SESSION_TTL_MS });
    res.cookie(COOKIE_NAME, token, {
      ...getSessionCookieOptions(req),
      maxAge: SESSION_TTL_MS,
    });
    res.json({ success: true });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
    res.json({ success: true });
  });
}
