import type { Request, Response, NextFunction } from "express";
import { siteUrl } from "./siteUrl";
/** Browser mutations must originate here. Header-key cron clients have no Origin. */
export function protectBrowserMutation(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  const crossSite = req.get("sec-fetch-site") === "cross-site";
  let valid = true;
  if (origin) {
    try {
      const allowed =
        process.env.NODE_ENV === "production"
          ? new URL(siteUrl()).origin
          : `${req.protocol}://${req.get("host")}`;
      valid = new URL(origin).origin === allowed;
    } catch {
      valid = false;
    }
  }
  if (!valid || crossSite) {
    res.status(403).json({ error: "Request origin is not allowed" });
    return;
  }
  next();
}
