/**
 * Guards the operational alert email used by the scheduler's terminal-failure
 * path. The point of the alert is that a silent failure (the weekly Instagram
 * post that died every Sunday unnoticed) becomes something the owner is told
 * about — so the send path must render and not throw, and must degrade
 * gracefully when RESEND_API_KEY isn't set rather than crashing the tick.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sendAdminAlertEmail } from "./mailer";

describe("sendAdminAlertEmail", () => {
  const prev = process.env.RESEND_API_KEY;
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prev;
  });

  it("dry-runs (no throw) when RESEND_API_KEY is unset", async () => {
    const res = await sendAdminAlertEmail({
      to: "ops@example.com",
      subject: "scheduler: instagram-weekly failed",
      jobKey: "instagram-weekly",
      detail: "Instagram weekly post failed: u is not iterable",
      when: "2026-06-07 09:19",
    });
    expect(res.delivered).toBe(false);
    if (!res.delivered) expect(res.reason).toBe("no-key");
  });

  it("sanitises angle brackets out of the error detail (no HTML injection)", async () => {
    // Just needs to render without throwing on a hostile detail string.
    const res = await sendAdminAlertEmail({
      to: "ops@example.com",
      subject: "scheduler: x failed",
      jobKey: "x",
      detail: "<script>alert(1)</script> boom",
      when: "2026-06-07 09:19",
    });
    expect(res.delivered).toBe(false);
  });
});
