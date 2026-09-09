import { INSTAGRAM_FEED_SLOTS } from "../../shared/instagramSchedule";
import { describe, expect, it } from "vitest";
import {
  EVIDENCE_JOBS,
  METRIC_RECOVERY_JOBS,
  isJobDue,
  sydneyClock,
  type SchedulerClock,
} from "./index";

const baseClock = (over: Partial<SchedulerClock> = {}): SchedulerClock => ({
  dateISO: "2026-06-04",
  minutes: 0,
  dow: 4, // Thursday
  dom: 4,
  ...over,
});

it("allows missing-data recovery after an evening deployment without reopening publication windows", () => {
  for (const minutes of [0, 239, 240, 480, 12 * 60, 22 * 60 + 30, 1439]) {
    const due = METRIC_RECOVERY_JOBS.filter((job) =>
      isJobDue(job, baseClock({ minutes })),
    );
    expect(due).toHaveLength(1);
    expect(due[0].key).toBe(
      `official-metrics-recovery-${String(Math.floor(minutes / 240) * 4).padStart(2, "0")}`,
    );
  }
  expect(new Set(METRIC_RECOVERY_JOBS.map((job) => job.key)).size).toBe(6);
});

describe("sydneyClock", () => {
  it("maps a UTC instant to Sydney time (AEST, winter = UTC+10)", () => {
    // June = AEST, no daylight saving. 00:00 UTC → 10:00 the same date.
    const c = sydneyClock(new Date("2026-06-04T00:00:00Z"));
    expect(c.dateISO).toBe("2026-06-04");
    expect(c.minutes).toBe(10 * 60);
    expect(c.dow).toBe(4); // Thursday
    expect(c.dom).toBe(4);
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
  const weekly = {
    key: "instagram-weekly",
    at: "09:19",
    dow: [0],
    run: async () => {},
  };

  it("is not due before its time", () => {
    expect(isJobDue(daily, baseClock({ minutes: 6 * 60 + 42 }))).toBe(false);
  });

  it("is due at its time and within the grace window", () => {
    expect(isJobDue(daily, baseClock({ minutes: 6 * 60 + 43 }))).toBe(true); // exactly on time
    expect(isJobDue(daily, baseClock({ minutes: 10 * 60 }))).toBe(true); // ~3h late, still in window
  });

  it("is NOT due once it's long overdue (no retroactive 2pm 'morning' post)", () => {
    // 06:43 + 5h grace = 11:43; an afternoon enable must not fire it.
    expect(isJobDue(daily, baseClock({ minutes: 14 * 60 }))).toBe(false);
    expect(isJobDue(daily, baseClock({ minutes: 23 * 60 }))).toBe(false);
  });

  it("a weekly job only fires on its day", () => {
    expect(isJobDue(weekly, baseClock({ minutes: 10 * 60, dow: 0 }))).toBe(
      true,
    ); // Sunday
    expect(isJobDue(weekly, baseClock({ minutes: 10 * 60, dow: 4 }))).toBe(
      false,
    ); // Thursday
  });

  it("a weekly job is still gated by time on its day", () => {
    expect(isJobDue(weekly, baseClock({ minutes: 9 * 60, dow: 0 }))).toBe(
      false,
    ); // before 09:19
  });

  it("runs a monthly job only on its day of the month", () => {
    const monthly = { key: "m", at: "08:00", dom: [1], run: async () => {} };
    expect(isJobDue(monthly, baseClock({ minutes: 8 * 60, dom: 1 }))).toBe(
      true,
    );
    expect(isJobDue(monthly, baseClock({ minutes: 8 * 60, dom: 2 }))).toBe(
      false,
    );
  });

  it("still honours the time window on a monthly job", () => {
    // Being the right day is not enough; a long-overdue monthly job is skipped
    // rather than fired retroactively, same as every other job.
    const monthly = { key: "m", at: "08:00", dom: [1], run: async () => {} };
    expect(isJobDue(monthly, baseClock({ minutes: 7 * 60 + 59, dom: 1 }))).toBe(
      false,
    );
  });

  it("treats dow and dom as both having to hold", () => {
    const both = {
      key: "m",
      at: "08:00",
      dow: [1],
      dom: [1],
      run: async () => {},
    };
    expect(isJobDue(both, baseClock({ minutes: 8 * 60, dow: 1, dom: 1 }))).toBe(
      true,
    );
    expect(isJobDue(both, baseClock({ minutes: 8 * 60, dow: 2, dom: 1 }))).toBe(
      false,
    );
    expect(isJobDue(both, baseClock({ minutes: 8 * 60, dow: 1, dom: 2 }))).toBe(
      false,
    );
  });
});

it("only catches up the current hourly evidence slot after a restart", () => {
  expect(EVIDENCE_JOBS).toHaveLength(24);
  for (const hour of [0, 6, 12, 23]) {
    const due = EVIDENCE_JOBS.filter((job) =>
      isJobDue(job, baseClock({ minutes: hour * 60 + 58 })),
    );
    expect(due.map((job) => job.at)).toEqual([
      `${String(hour).padStart(2, "0")}:00`,
    ]);
  }
});

describe("shared Australian social cadence", () => {
  const job = (slot: keyof typeof INSTAGRAM_FEED_SLOTS) => ({
    key: slot,
    ...INSTAGRAM_FEED_SLOTS[slot],
    run: async () => {},
  });
  it("keeps briefings on weekdays and number cards on Tuesday/Thursday", () => {
    expect(isJobDue(job("daily"), baseClock({ dow: 1, minutes: 450 }))).toBe(
      true,
    );
    expect(isJobDue(job("daily"), baseClock({ dow: 0, minutes: 450 }))).toBe(
      false,
    );
    expect(isJobDue(job("daily"), baseClock({ dow: 6, minutes: 450 }))).toBe(
      false,
    );
    expect(isJobDue(job("stat"), baseClock({ dow: 2, minutes: 750 }))).toBe(
      true,
    );
    expect(isJobDue(job("stat"), baseClock({ dow: 3, minutes: 750 }))).toBe(
      false,
    );
  });
  it("replaces the number card on the 1st and stops late catch-up", () => {
    const first = baseClock({ dow: 2, dom: 1, minutes: 750 });
    expect(isJobDue(job("stat"), first)).toBe(false);
    expect(isJobDue(job("monthly"), first)).toBe(true);
    expect(isJobDue(job("daily"), baseClock({ dow: 1, minutes: 511 }))).toBe(
      false,
    );
    expect(isJobDue(job("weekly"), baseClock({ dow: 0, minutes: 630 }))).toBe(
      true,
    );
    expect(isJobDue(job("weekly"), baseClock({ dow: 0, minutes: 631 }))).toBe(
      false,
    );
  });
});
