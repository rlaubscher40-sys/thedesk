import { describe, expect, it } from "vitest";
import { normaliseUptimeWebhook } from "./uptimeWebhook";

/** Unwrap a result that should be a recorded ping; fails loudly if it isn't. */
const pingOf = (body: unknown) => {
  const r = normaliseUptimeWebhook(body);
  if (r.kind !== "ping") throw new Error(`expected a ping, got "${r.kind}"`);
  return r.ping;
};

describe("normaliseUptimeWebhook — UptimeRobot", () => {
  it("reads a down alert and pulls the status code out of the prose", () => {
    expect(
      pingOf({
        monitorFriendlyName: "The Desk",
        alertType: "1",
        alertTypeFriendlyName: "Down",
        alertDetails: "HTTP 503 - Service Unavailable",
        responseTime: "0",
      })
    ).toEqual({
      statusCode: 503,
      latencyMs: 0,
      source: "uptimerobot",
      region: null,
    });
  });

  it("falls back to 503 when the reason names no status code", () => {
    const p = pingOf({ alertType: "1", alertDetails: "Connection Timeout" });
    expect(p.statusCode).toBe(503);
  });

  it("reads an up alert, keeping the reported response time", () => {
    expect(
      pingOf({
        alertType: "2",
        alertTypeFriendlyName: "Up",
        alertDetails: "OK",
        responseTime: "412",
      })
    ).toEqual({
      statusCode: 200,
      latencyMs: 412,
      source: "uptimerobot",
      region: null,
    });
  });

  it("accepts alertType as a number, not just a string", () => {
    expect(pingOf({ alertType: 2 }).statusCode).toBe(200);
    expect(pingOf({ alertType: 1 }).statusCode).toBe(503);
  });

  it("acknowledges SSL-expiry notices without recording an outage", () => {
    // alertType 3 carries no liveness signal — an expiring cert on a healthy
    // site must not show up in the panel as downtime. It still has to answer
    // 200, or UptimeRobot logs a failed delivery and flags a broken webhook.
    expect(normaliseUptimeWebhook({ alertType: "3" })).toEqual({
      kind: "ignored",
      reason: "ssl-expiry",
    });
  });

  it("rejects an alertType outside the documented set", () => {
    expect(normaliseUptimeWebhook({ alertType: "99" }).kind).toBe("unrecognised");
    expect(normaliseUptimeWebhook({ alertType: "nonsense" }).kind).toBe("unrecognised");
  });
});

describe("normaliseUptimeWebhook — Better Stack", () => {
  it("reads an open incident as down, using the reported response code", () => {
    expect(
      pingOf({
        data: {
          type: "incident",
          attributes: {
            name: "The Desk",
            cause: "HTTP 500",
            response_code: 500,
            started_at: "2026-08-06T17:19:38Z",
            resolved_at: null,
          },
        },
      })
    ).toMatchObject({ statusCode: 500, source: "betterstack" });
  });

  it("reads a resolved incident as up", () => {
    const p = pingOf({
      data: {
        type: "incident",
        attributes: {
          cause: "recovered",
          resolved_at: "2026-08-06T17:34:40Z",
        },
      },
    });
    expect(p.statusCode).toBe(200);
  });

  it("derives the status from the cause when no response_code is given", () => {
    const p = pingOf({
      data: { attributes: { cause: "HTTP 502 Bad Gateway", resolved_at: null } },
    });
    expect(p.statusCode).toBe(502);
  });
});

describe("normaliseUptimeWebhook — generic", () => {
  it("passes through the /api/uptime/record shape", () => {
    expect(
      pingOf({
        statusCode: 200,
        latencyMs: 987,
        source: "cron-job.org",
        region: "syd",
      })
    ).toEqual({
      statusCode: 200,
      latencyMs: 987,
      source: "cron-job.org",
      region: "syd",
    });
  });

  it("clamps a latency beyond the column's sane ceiling", () => {
    expect(pingOf({ statusCode: 200, latencyMs: 999_999 }).latencyMs).toBe(120_000);
  });

  it("truncates an over-long source to the column width", () => {
    expect(pingOf({ statusCode: 200, source: "x".repeat(200) }).source).toHaveLength(64);
  });

  it("treats a nonsense status code as up rather than writing it", () => {
    // Out of range can't go in the column; 200 is the safe read for a
    // monitor that bothered to POST at all.
    expect(pingOf({ statusCode: 99_999 }).statusCode).toBe(200);
  });
});

describe("normaliseUptimeWebhook — unrecognised", () => {
  it.each([
    ["null", null],
    ["a string", "down!"],
    ["an array", [{ statusCode: 200 }]],
    ["an empty object", {}],
    ["an unknown shape", { foo: "bar" }],
  ])("rejects %s", (_label, body) => {
    expect(normaliseUptimeWebhook(body).kind).toBe("unrecognised");
  });
});
