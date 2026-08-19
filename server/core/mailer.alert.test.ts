/**
 * Guards the operational alert email used by the scheduler's terminal-failure
 * path. The point of the alert is that a silent failure (the weekly Instagram
 * post that died every Sunday unnoticed) becomes something the owner is told
 * about — so the send path must render and not throw, and must degrade
 * gracefully when RESEND_API_KEY isn't set rather than crashing the tick.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attemptSentence, sendAdminAlertEmail } from "./mailer";

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

// The alert used to claim "it exhausted its retries" regardless of how many
// attempts the job was configured for. On a maxAttempts:1 posting job that was
// actively misleading: the first failure is the last, and no retry ever
// happened. The wording has to distinguish the two, because it changes what the
// reader does next.
describe("attemptSentence", () => {
  it("says so plainly when the job only ever gets one attempt", () => {
    const s = attemptSentence("2026-08-20 07:14", 1, 1);
    expect(s).toContain("only attempt");
    expect(s).not.toMatch(/retries|\btimes\b/);
  });

  it("gives the real count when the job did retry and ran out", () => {
    const s = attemptSentence("2026-08-20 07:19", 2, 2);
    expect(s).toContain("failed 2 times");
    expect(s).toContain("no attempts left today");
  });

  it("falls back to neutral phrasing when the counts are unknown", () => {
    // No invented count — a caller that doesn't pass them shouldn't produce
    // a sentence asserting how many attempts were made.
    const s = attemptSentence("2026-08-20 07:14");
    expect(s).toContain("no attempts left today");
    expect(s).not.toMatch(/\d+ times|only attempt/);
  });

  it("always carries the timestamp it was given", () => {
    for (const args of [
      [1, 1],
      [2, 2],
      [undefined, undefined],
    ] as const) {
      expect(attemptSentence("2026-08-20 07:14", args[0], args[1])).toContain("2026-08-20 07:14");
    }
  });
});
