import { createHmac, timingSafeEqual } from "node:crypto";
import type { Express } from "express";
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
  app.get("/api/unsubscribe", async (req, res) => {
    const { email, sig } = req.query;
    if (typeof email !== "string" || typeof sig !== "string") {
      res.status(400).send(PAGE("This unsubscribe link is missing required parameters.", false));
      return;
    }
    const expected = createHmac("sha256", env.cookieSecret || "dev")
      .update(email)
      .digest("base64url");
    const sigOk = sig.length === expected.length &&
      timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!sigOk) {
      res.status(403).send(PAGE("This unsubscribe link is invalid or has already been used.", false));
      return;
    }
    await db.unsubscribeByEmail(email);
    res.send(PAGE("You won't receive any more emails from The Desk. If this was a mistake, just re-subscribe on the site.", true));
  });
}
