import { createHmac, timingSafeEqual } from "node:crypto";
import type { Express } from "express";
import rateLimit from "express-rate-limit";
import { env } from "./env";
import * as db from "../db";

const PAGE = (msg: string, sub: boolean) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${sub ? "Unsubscribed" : "Invalid link"} · The Desk</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0c1220;color:#f0ede8;font-family:Georgia,'Times New Roman',serif;
         display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
    .card{max-width:480px;width:100%;text-align:center}
    .overline{font-family:'Courier New',monospace;font-size:10px;letter-spacing:.22em;
              color:#9ba3b5;text-transform:uppercase;margin-bottom:20px}
    h1{font-size:28px;font-weight:700;letter-spacing:-.02em;margin-bottom:12px;
       color:${sub ? "#f0c75e" : "#f0ede8"}}
    p{font-size:16px;line-height:1.6;color:#9ba3b5;margin-bottom:24px}
    a{color:#d4a853;font-family:'Courier New',monospace;font-size:12px;letter-spacing:.18em;
      text-transform:uppercase;text-decoration:none}
    a:hover{text-decoration:underline}
  </style>
</head>
<body>
  <div class="card">
    <p class="overline">The Desk · Intelligence</p>
    <h1>${sub ? "You're unsubscribed." : "Invalid link."}</h1>
    <p>${msg}</p>
    <a href="/">← Back to The Desk</a>
  </div>
</body>
</html>`;

export function registerUnsubscribeRoute(app: Express): void {
  // Public (clicked from email, no session). The HMAC check is already
  // constant-time; the limiter keeps the endpoint from being used to
  // enumerate signatures or hammer the subscribers table.
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: false,
    legacyHeaders: false,
    message: "Too many requests.",
  });
  app.get("/api/unsubscribe", limiter, async (req, res) => {
    const { email, sig, exp } = req.query;
    if (typeof email !== "string" || typeof sig !== "string") {
      res.status(400).send(PAGE("This unsubscribe link is missing required parameters.", false));
      return;
    }
    // Current links sign `email:exp` so they age out after 90 days. Links
    // sent before the expiry shipped sign the bare email — keep honouring
    // those so an unsubscribe from an older email still works. Safe to drop
    // the legacy branch once every email in flight predates it by a quarter
    // (any time after 2026-09).
    let payload: string;
    if (typeof exp === "string") {
      const expMs = Number(exp);
      if (!Number.isFinite(expMs) || Date.now() > expMs) {
        res.status(403).send(PAGE("This unsubscribe link has expired. Use the link in a more recent email, or reply to any edition and we'll remove you by hand.", false));
        return;
      }
      payload = `${email}:${exp}`;
    } else {
      payload = email;
    }
    const expected = createHmac("sha256", env.cookieSecret || "dev")
      .update(payload)
      .digest("base64url");
    const sigOk = sig.length === expected.length &&
      timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!sigOk) {
      res.status(403).send(PAGE("This unsubscribe link is invalid.", false));
      return;
    }
    await db.unsubscribeByEmail(email);
    res.send(PAGE("You won't receive any more emails from The Desk. If this was a mistake, just re-subscribe on the site.", true));
  });
}
