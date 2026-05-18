import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { getNextEditionLabel, getSydneyIsoDate, getIsoWeekId } from "./date";

describe("getNextEditionLabel", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns today when called before 7am on a Sydney Sunday", () => {
    // 2026-05-17 (Sunday) 03:00 AEST = 17:00 UTC the prior day.
    vi.setSystemTime(new Date("2026-05-16T17:00:00Z"));
    expect(getNextEditionLabel()).toBe("Sun, 17 May");
  });

  it("returns the upcoming Sunday from a weekday", () => {
    // 2026-05-13 (Wednesday) 22:00 Sydney = 12:00 UTC.
    vi.setSystemTime(new Date("2026-05-13T12:00:00Z"));
    expect(getNextEditionLabel()).toBe("Sun, 17 May");
  });

  it("rolls to next Sunday once it's past 7am on the current Sunday", () => {
    // 2026-05-17 (Sunday) 10:00 AEST = 00:00 UTC.
    vi.setSystemTime(new Date("2026-05-17T00:00:00Z"));
    expect(getNextEditionLabel()).toBe("Sun, 24 May");
  });
});

describe("getSydneyIsoDate", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns the Sydney calendar date even when UTC is the day before", () => {
    // 14:00 UTC = 00:00 AEST the next day.
    vi.setSystemTime(new Date("2026-05-13T14:00:00Z"));
    expect(getSydneyIsoDate()).toBe("2026-05-14");
  });
});

describe("getIsoWeekId", () => {
  it("formats the week id as YYYY-Www", () => {
    // 2026-05-13 is a Wednesday in ISO week 20.
    const id = getIsoWeekId(new Date("2026-05-13T00:00:00Z"));
    expect(id).toMatch(/^2026-W\d{2}$/);
  });
});
