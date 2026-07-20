import { createHmac, timingSafeEqual } from "node:crypto";
import type { Express } from "express";
import rateLimit from "express-rate-limit";
import { signingSecret } from "./env";
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

/** Outcome of validating an unsubscribe request's email/sig/exp triple. */
type UnsubResult = { ok: true; email: string } | { ok: false; status: number; reason: string };

/**
 * Validate the signed unsubscribe params (shared by the GET link and the
 * one-click POST). Constant-time HMAC compare so latency can't be used to
 * recover the signature.
 */
function validateUnsubscribe(rawEmail: unknown, rawSig: unknown, rawExp: unknown): UnsubResult {
  if (typeof rawEmail !== "string" || typeof rawSig !== "string") {
    return {
      ok: false,
      status: 400,
      reason: "This unsubscribe link is missing required parameters.",
    };
  }
  // Current links sign `email:exp` so they age out after 90 days. Links
  // sent before the expiry shipped sign the bare email — keep honouring
  // those so an unsubscribe from an older email still works. Safe to drop
  // the legacy branch once every email in flight predates it by a quarter
  // (any time after 2026-09).
  let payload: string;
  if (typeof rawExp === "string") {
    const expMs = Number(rawExp);
    if (!Number.isFinite(expMs) || Date.now() > expMs) {
      return {
        ok: false,
        status: 403,
        reason:
          "This unsubscribe link has expired. Use the link in a more recent email, or reply to any edition and we'll remove you by hand.",
      };
    }
    payload = `${rawEmail}:${rawExp}`;
  } else {
    payload = rawEmail;
  }
  const expected = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  const sigOk =
    rawSig.length === expected.length &&
    timingSafeEqual(Buffer.from(rawSig), Buffer.from(expected));
  if (!sigOk) {
    return { ok: false, status: 403, reason: "This unsubscribe link is invalid." };
  }
  return { ok: true, email: rawEmail };
}

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
    const result = validateUnsubscribe(req.query.email, req.query.sig, req.query.exp);
    if (!result.ok) {
      res.status(result.status).send(PAGE(result.reason, false));
      return;
    }
    await db.unsubscribeByEmail(result.email);
    res.send(
      PAGE(
        "You won't receive any more emails from The Desk. If this was a mistake, just re-subscribe on the site.",
        true
      )
    );
  });

  // RFC 8058 one-click unsubscribe: mail clients (Gmail, Yahoo) POST the
  // List-Unsubscribe URL directly, with no browser and no rendered page, so
  // the response is a bare 204 rather than the HTML confirmation. Same signed
  // params as the GET — read from the form body or, since the URL carries the
  // query string too, fall back to the query.
  app.post("/api/unsubscribe", limiter, async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const result = validateUnsubscribe(
      body.email ?? req.query.email,
      body.sig ?? req.query.sig,
      body.exp ?? req.query.exp
    );
    if (!result.ok) {
      res.status(result.status).end();
      return;
    }
    await db.unsubscribeByEmail(result.email);
    res.status(204).end();
  });
}
