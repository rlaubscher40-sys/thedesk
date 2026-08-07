/**
 * Uptime webhook — ingests state-change alerts from an external monitor.
 *
 * Why this exists: the in-process sampler (server/scheduler/uptimeSampler)
 * gives a dense latency history, but it runs *inside* the app, so it records
 * nothing during an outage — the one window that matters most. An external
 * monitor is the only thing that can observe the site being down, so its
 * up/down transitions are posted here and stored alongside the samples.
 *
 * Uptime services fire webhooks on **state change**, not on every check. So
 * expect a couple of rows a month from this endpoint, not one every 5 minutes.
 * That's the intended split:
 *   · sampler  → dense latency series while the app is up
 *   · webhook  → authoritative down/up transitions, including while it's not
 *
 * Payload shapes are normalised in `normaliseUptimeWebhook` so the same route
 * works with UptimeRobot, Better Stack, or a plain JSON POST from anything
 * else — see docs/uptime-monitoring.md for the setup steps.
 */
import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import * as db from "../db";

export type NormalisedPing = {
  statusCode: number;
  latencyMs: number;
  source: string;
  region: string | null;
};

/**
 * Three outcomes, not two. "Ignored" matters: a payload we understand and
 * deliberately don't record (an SSL-expiry notice) must answer 200, or the
 * monitor logs a failed delivery and starts warning about a broken webhook.
 * Only a body we genuinely can't read earns a 400.
 */
export type WebhookResult =
  | { kind: "ping"; ping: NormalisedPing }
  | { kind: "ignored"; reason: string }
  | { kind: "unrecognised" };

const ping = (p: NormalisedPing): WebhookResult => ({ kind: "ping", ping: p });

/** Status code recorded when a monitor says "down" without naming one. */
const ASSUMED_DOWN_CODE = 503;
/** Status code recorded when a monitor says "up" without naming one. */
const ASSUMED_UP_CODE = 200;

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** Coerce the string-or-number scalars these services mix freely. */
function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.round(n);
  }
  return null;
}

function clampStatus(n: number | null, fallback: number): number {
  if (n === null || n < 0 || n > 999) return fallback;
  return n;
}

function clampLatency(n: number | null): number {
  if (n === null || n < 0) return 0;
  return Math.min(n, 120_000);
}

/**
 * UptimeRobot writes the failure reason as prose ("HTTP 503 - Service
 * Unavailable", "Connection Timeout"). Pull a real status code out when one
 * is there; the caller falls back to ASSUMED_DOWN_CODE when it isn't.
 */
function statusFromProse(text: unknown): number | null {
  if (typeof text !== "string") return null;
  const m = /\b(?:HTTP|status(?:\s+code)?)\s*[:=]?\s*(\d{3})\b/i.exec(text);
  return m ? Number(m[1]) : null;
}

/**
 * Map any supported monitor payload onto a ping row. See WebhookResult for
 * why "we understood it and chose not to record it" is a distinct outcome
 * from "we couldn't read it at all".
 */
export function normaliseUptimeWebhook(body: unknown): WebhookResult {
  const b = asRecord(body);
  if (!b) return { kind: "unrecognised" };

  // ── UptimeRobot ────────────────────────────────────────────────────────
  // alertType 1 = down, 2 = up, 3 = SSL expiry. Sent as a string in the
  // default JSON template and as a number if hand-templated, hence num().
  if ("alertType" in b) {
    const alertType = num(b.alertType);
    // SSL-expiry notices carry no liveness signal — acknowledge without
    // writing a row, so an expiring cert doesn't read as an outage.
    if (alertType === 3) return { kind: "ignored", reason: "ssl-expiry" };
    if (alertType !== 1 && alertType !== 2) return { kind: "unrecognised" };
    const isUp = alertType === 2;
    return ping({
      statusCode: clampStatus(
        statusFromProse(b.alertDetails),
        isUp ? ASSUMED_UP_CODE : ASSUMED_DOWN_CODE
      ),
      latencyMs: clampLatency(num(b.responseTime)),
      source: "uptimerobot",
      region: null,
    });
  }

  // ── Better Stack ───────────────────────────────────────────────────────
  // { data: { type: "incident", attributes: { response_code, resolved_at } } }
  const data = asRecord(b.data);
  const attrs = data ? asRecord(data.attributes) : null;
  if (attrs) {
    // resolved_at set = the incident closed, i.e. the site came back up.
    const resolved = attrs.resolved_at !== null && attrs.resolved_at !== undefined;
    return ping({
      statusCode: clampStatus(
        num(attrs.response_code) ?? statusFromProse(attrs.cause),
        resolved ? ASSUMED_UP_CODE : ASSUMED_DOWN_CODE
      ),
      latencyMs: 0, // Better Stack incidents carry no timing figure.
      source: "betterstack",
      region: typeof attrs.regions === "string" ? attrs.regions.slice(0, 32) : null,
    });
  }

  // ── Generic ────────────────────────────────────────────────────────────
  // Same shape as /api/uptime/record, so anything scriptable can post here.
  const statusCode = num(b.statusCode);
  if (statusCode !== null) {
    return ping({
      statusCode: clampStatus(statusCode, ASSUMED_UP_CODE),
      latencyMs: clampLatency(num(b.latencyMs)),
      source:
        typeof b.source === "string" && b.source.trim() !== "" ? b.source.slice(0, 64) : "external",
      region: typeof b.region === "string" ? b.region.slice(0, 32) : null,
    });
  }

  return { kind: "unrecognised" };
}

/**
 * Constant-time key check. Accepts the key in the `x-scheduled-key` header
 * (preferred) or a `?key=` query param, because UptimeRobot's free tier can
 * set the webhook URL but not custom headers. The query form is the weaker
 * of the two — it lands in access logs and referrers — so the header wins
 * when both are present.
 */
export function webhookAuthorised(req: Request): boolean {
  const expected = process.env.SCHEDULED_API_KEY;
  if (!expected) return false;
  const header = req.header("x-scheduled-key");
  const query = typeof req.query.key === "string" ? req.query.key : undefined;
  const got = header ?? query;
  if (typeof got !== "string" || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

export async function handleUptimeWebhook(req: Request, res: Response): Promise<void> {
  if (!webhookAuthorised(req)) {
    res.status(401).send("Unauthorised");
    return;
  }
  const result = normaliseUptimeWebhook(req.body);
  if (result.kind === "unrecognised") {
    // 400 with a hint: a misconfigured monitor shows up in that service's
    // own delivery log, which is where you'd be looking.
    res.status(400).json({
      error:
        "Unrecognised webhook payload. Expected UptimeRobot, Better Stack, " +
        "or {statusCode, latencyMs}.",
    });
    return;
  }
  if (result.kind === "ignored") {
    res.json({ ok: true, ignored: result.reason });
    return;
  }
  await db.recordUptimePing(result.ping);
  res.json({ ok: true, recorded: result.ping });
}
