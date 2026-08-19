/**
 * Guards the "did anything post today?" read behind the admin panel's re-run
 * buttons. The trap this locks down is the feedDate/createdAt distinction: a
 * scheduled post records feedDate as null, so keying on it would show "not
 * today" for every normal run and make the panel cry wolf every morning.
 *
 * Every fixture is built from LOCAL date components (`new Date(y, m, d, h)`)
 * rather than a zoned ISO string, so the assertions hold whatever timezone the
 * runner is in. postedToday compares local calendar days on purpose — the panel
 * should agree with the clock on the reader's device — and an ISO fixture made
 * "today" in Sydney reads as yesterday on a UTC CI box.
 */
import { describe, expect, it } from "vitest";
import { jobState, postedToday, slotHasPassed } from "./instagramRuns";

/** Local 20 Aug 2026, 09:30 — mid-morning, well clear of a day boundary. */
const NOW = new Date(2026, 7, 20, 9, 30);
/** A local wall-clock time on a given day of that same month. */
const at = (day: number, hour: number) => new Date(2026, 7, day, hour, 0);

describe("postedToday", () => {
  it("reports a job posted when its row was created today", () => {
    expect(postedToday([{ postType: "daily", createdAt: at(20, 7) }], NOW).has("daily")).toBe(true);
  });

  it("keys on createdAt, not feedDate — a scheduled post has a null feedDate", () => {
    // The row a scheduled run actually writes: real createdAt, no feedDate.
    const posts = [{ postType: "daily", createdAt: at(20, 7), feedDate: null }];
    expect(postedToday(posts, NOW).has("daily")).toBe(true);
  });

  it("does not count yesterday's post as today's", () => {
    expect(postedToday([{ postType: "daily", createdAt: at(19, 7) }], NOW).has("daily")).toBe(
      false
    );
  });

  it("tracks each posting stream separately", () => {
    const posts = [
      { postType: "daily", createdAt: at(20, 7) }, // today
      { postType: "coverage", createdAt: at(19, 12) }, // yesterday
    ];
    const done = postedToday(posts, NOW);
    expect(done.has("daily")).toBe(true);
    expect(done.has("coverage")).toBe(false);
    expect(done.has("weekly")).toBe(false);
  });

  it("accepts an ISO string as well as a Date", () => {
    const posts = [{ postType: "weekly", createdAt: at(20, 7).toISOString() }];
    expect(postedToday(posts, NOW).has("weekly")).toBe(true);
  });

  it("counts a post made later the same day (a hand re-run after a failure)", () => {
    const posts = [{ postType: "daily", createdAt: at(20, 9) }];
    expect(postedToday(posts, NOW).has("daily")).toBe(true);
  });

  it("ignores an unparseable timestamp instead of throwing", () => {
    expect(postedToday([{ postType: "daily", createdAt: "not a date" }], NOW).size).toBe(0);
  });

  it("returns an empty set for an empty log", () => {
    expect(postedToday([], NOW).size).toBe(0);
  });
});

// An indicator that flags every job outside its slot is noise, not a signal:
// the Sunday-only weekly would read as missing all week and the midday coverage
// post all morning, burying the one case worth showing.
describe("slotHasPassed", () => {
  const sunday9am = new Date(2026, 7, 23, 9, 0); // 23 Aug 2026 is a Sunday
  const thursday9am = new Date(2026, 7, 20, 9, 0);

  it("is false before the job's time on the day", () => {
    expect(slotHasPassed("12:13", null, thursday9am)).toBe(false);
  });

  it("is true once the time has passed", () => {
    expect(slotHasPassed("07:13", null, thursday9am)).toBe(true);
  });

  it("is true exactly on the minute", () => {
    expect(slotHasPassed("09:00", null, thursday9am)).toBe(true);
  });

  it("is false on a day a weekday-restricted job doesn't run", () => {
    // The Sunday-only weekly, seen on a Thursday: not due, so not missing.
    expect(slotHasPassed("09:19", 0, thursday9am)).toBe(false);
  });

  it("respects the time on the day the restricted job does run", () => {
    expect(slotHasPassed("09:19", 0, sunday9am)).toBe(false); // 09:00 < 09:19
    expect(slotHasPassed("08:19", 0, sunday9am)).toBe(true);
  });
});

describe("jobState", () => {
  it("flags a job only when its slot passed and nothing posted", () => {
    expect(jobState(false, true)).toBe("missing");
  });

  it("stays quiet before the slot comes round", () => {
    expect(jobState(false, false)).toBe("pending");
  });

  it("reports a posted job regardless of the clock", () => {
    expect(jobState(true, false)).toBe("posted");
    expect(jobState(true, true)).toBe("posted");
  });

  it("never guesses while the log is still loading", () => {
    // A wrong "missing" is a false alarm, so unknown must not collapse to it.
    expect(jobState(null, true)).toBe("unknown");
    expect(jobState(null, false)).toBe("unknown");
  });
});
