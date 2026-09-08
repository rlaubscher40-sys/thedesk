import { describe, expect, it } from "vitest";
import { isWeekdayBriefDate } from "./briefSchedule";
describe("weekday email promise", () => {
  it("includes weekdays and skips weekends while feed ingestion can continue", () => {
    expect([7, 8, 9, 10, 11, 12, 13].map((day) => isWeekdayBriefDate(`2026-09-${String(day).padStart(2, "0")}`)))
      .toEqual([true, true, true, true, true, false, false]);
  });
  it("rejects malformed or nonexistent dates", () => {
    for (const date of ["", "2026-02-30", "garbage", "2026-09-08T00:00:00Z"])
      expect(isWeekdayBriefDate(date)).toBe(false);
  });
});
