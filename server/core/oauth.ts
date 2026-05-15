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
import { sdk } from "./sdk";

export function registerOAuthRoutes(app: Express): void {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!password) {
      res.status(400).json({ error: "password is required" });
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
