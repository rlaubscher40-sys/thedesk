import { describe, expect, it } from "vitest";
import { isJobDue, sydneyClock, type SchedulerClock } from "./index";

const baseClock = (over: Partial<SchedulerClock> = {}): SchedulerClock => ({
  dateISO: "2026-06-04",
  minutes: 0,
  dow: 4, // Thursday
  ...over,
});

describe("sydneyClock", () => {
  it("maps a UTC instant to Sydney time (AEST, winter = UTC+10)", () => {
    // June = AEST, no daylight saving. 00:00 UTC → 10:00 the same date.
    const c = sydneyClock(new Date("2026-06-04T00:00:00Z"));
    expect(c.dateISO).toBe("2026-06-04");
    expect(c.minutes).toBe(10 * 60);
    expect(c.dow).toBe(4); // Thursday
  });

  it("honours daylight saving (AEDT, summer = UTC+11)", () => {
    // January = AEDT. 00:00 UTC → 11:00 the same date.
    const c = sydneyClock(new Date("2026-01-15T00:00:00Z"));
    expect(c.dateISO).toBe("2026-01-15");
    expect(c.minutes).toBe(11 * 60);
  });

  it("returns an in-range clock for 'now'", () => {
    const c = sydneyClock();
    expect(c.minutes).toBeGreaterThanOrEqual(0);
    expect(c.minutes).toBeLessThan(24 * 60);
    expect(c.dow).toBeGreaterThanOrEqual(0);
    expect(c.dow).toBeLessThanOrEqual(6);
    expect(c.dateISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("isJobDue", () => {
  const daily = { key: "daily-feed", at: "06:43", run: async () => {} };
  const weekly = { key: "instagram-weekly", at: "09:19", dow: [0], run: async () => {} };

  it("is not due before its time", () => {
    expect(isJobDue(daily, baseClock({ minutes: 6 * 60 + 42 }))).toBe(false);
  });

  it("is due at and after its time", () => {
    expect(isJobDue(daily, baseClock({ minutes: 6 * 60 + 43 }))).toBe(true);
    expect(isJobDue(daily, baseClock({ minutes: 23 * 60 }))).toBe(true);
  });

  it("a weekly job only fires on its day", () => {
    expect(isJobDue(weekly, baseClock({ minutes: 10 * 60, dow: 0 }))).toBe(true); // Sunday
    expect(isJobDue(weekly, baseClock({ minutes: 10 * 60, dow: 4 }))).toBe(false); // Thursday
  });

  it("a weekly job is still gated by time on its day", () => {
    expect(isJobDue(weekly, baseClock({ minutes: 9 * 60, dow: 0 }))).toBe(false); // before 09:19
  });
});
