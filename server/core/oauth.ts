import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import { upsertUser } from "../db/users";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function qp(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express): void {
  app.get("/api/oauth/callback", async (req, res: Response) => {
    const code = qp(req, "code");
    const state = qp(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const token = await sdk.exchangeCodeForToken(code, state);
      const info = await sdk.getUserInfo(token.accessToken);
      if (!info.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: info.openId,
        name: info.name ?? null,
        email: info.email ?? null,
        loginMethod: info.platform ?? null,
        lastSignedIn: new Date(),
      });
      const sessionToken = await sdk.createSessionToken(info.openId, {
        name: info.name ?? "",
        expiresInMs: ONE_YEAR_MS,
      });
      res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (err) {
      console.error("[oauth] callback failed:", err);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
