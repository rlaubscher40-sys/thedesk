import { describe, expect, it } from "vitest";
import { dailyBriefWindow, isWeekdayBriefDate } from "./briefSchedule";
describe("weekday email promise", () => {
  it("includes weekdays and skips weekends while feed ingestion can continue", () => {
    expect(
      [7, 8, 9, 10, 11, 12, 13].map((day) =>
        isWeekdayBriefDate(`2026-09-${String(day).padStart(2, "0")}`)
      )
    ).toEqual([true, true, true, true, true, false, false]);
  });
  it("rejects malformed or nonexistent dates", () => {
    for (const date of ["", "2026-02-30", "garbage", "2026-09-08T00:00:00Z"])
      expect(isWeekdayBriefDate(date)).toBe(false);
  });
});

it("uses Sydney weekdays and a 7am to noon window through daylight saving", () => {
  for (const [stamp, expected] of [
    ["2026-09-09T20:59:59Z", null],
    ["2026-09-09T21:00:00Z", "2026-09-10"],
    ["2026-09-10T01:59:59Z", "2026-09-10"],
    ["2026-09-10T02:00:00Z", null],
    ["2026-09-11T21:00:00Z", null],
    ["2026-12-06T19:59:59Z", null],
    ["2026-12-06T20:00:00Z", "2026-12-07"],
    ["2026-12-07T01:00:00Z", null],
  ] as const)
    expect(dailyBriefWindow(new Date(stamp))).toBe(expected);
});
