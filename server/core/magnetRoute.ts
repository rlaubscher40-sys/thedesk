/**
 * Lead-magnet delivery route: /api/magnet/:slug?token=…
 *
 * The confirm link in the lead-magnet email points here. It confirms the
 * subscriber (double opt-in) and 302-redirects to the magnet's asset, so the
 * reader gets what they came for in the same click that verifies their email.
 *
 * A bad or expired token renders a small branded page pointing back at the
 * landing page to request a fresh link, mirroring the unsubscribe route.
 */
import type { Express } from "express";
import rateLimit from "express-rate-limit";
import * as db from "../db";
import { getLeadMagnet } from "../../shared/leadMagnets";
import { routeParam } from "./requestParams";

const PAGE = (title: string, msg: string, slug: string, ok: boolean) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} · The Desk</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0c1220;color:#f0ede8;font-family:Georgia,'Times New Roman',serif;
         display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
    .card{max-width:480px;width:100%;text-align:center}
    .overline{font-family:'Courier New',monospace;font-size:10px;letter-spacing:.22em;
              color:#9ba3b5;text-transform:uppercase;margin-bottom:20px}
    h1{font-size:28px;font-weight:700;letter-spacing:-.02em;margin-bottom:12px;
       color:${ok ? "#f0c75e" : "#f0ede8"}}
    p{font-size:16px;line-height:1.6;color:#9ba3b5;margin-bottom:24px}
    a{color:#d4a853;font-family:'Courier New',monospace;font-size:12px;letter-spacing:.18em;
      text-transform:uppercase;text-decoration:none}
    a:hover{text-decoration:underline}
  </style>
</head>
<body>
  <div class="card">
    <p class="overline">The Desk · Intelligence</p>
    <h1>${title}</h1>
    <p>${msg}</p>
    <a href="/free/${slug}">← Request a fresh link</a>
  </div>
</body>
</html>`;

export function registerMagnetRoute(app: Express): void {
  const limiter = rateLimit({
    windowMs: 60_000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.get("/api/magnet/:slug", limiter, async (req, res) => {
    const slug = routeParam(req.params.slug);
    const magnet = getLeadMagnet(slug);
    if (!magnet) {
      res
        .status(404)
        .type("html")
        .send(PAGE("Not found", "That resource doesn't exist.", "", false));
      return;
    }

    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) {
      res
        .status(400)
        .type("html")
        .send(PAGE("Invalid link", "This download link is missing its token.", slug, false));
      return;
    }

    try {
      const result = await db.confirmSubscriber(token);
      if (result.status === "confirmed") {
        // Off to the asset. 302 so the link itself stays the canonical
        // entry point rather than being cached as the asset URL.
        res.redirect(302, magnet.deliveryUrl);
        return;
      }
      if (result.status === "expired") {
        res
          .status(410)
          .type("html")
          .send(
            PAGE(
              "Link expired",
              "This download link has expired. Request a fresh one and we'll send it straight over.",
              slug,
              false
            )
          );
        return;
      }
      res
        .status(404)
        .type("html")
        .send(
          PAGE(
            "Invalid link",
            "This download link is invalid or has already been used. Request a fresh one below.",
            slug,
            false
          )
        );
    } catch (err) {
      console.warn(`[magnet] delivery failed for ${slug}:`, (err as Error).message);
      res
        .status(500)
        .type("html")
        .send(
          PAGE("Something went wrong", "We couldn't process that just now. Try again.", slug, false)
        );
    }
  });
}
