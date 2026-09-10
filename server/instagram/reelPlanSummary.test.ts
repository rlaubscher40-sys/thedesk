import { describe, it, expect } from "vitest";
import { nextReelWindow, describeReelPlan } from "./reelPlanSummary";
const candidate = { topic: "Housing", publication: { key: "housing", date: "2025-12-31" } };
describe("honest Sydney posting status", () => {
  it.each([
    ["2026-09-10T19:00:00Z", false, "2026-09-11T08:30:00.000Z"],
    ["2026-09-11T08:45:00Z", false, "2026-09-11T08:30:00.000Z"],
    ["2026-09-11T10:00:00Z", false, "2026-09-12T08:30:00.000Z"],
    ["2026-09-11T08:45:00Z", true, "2026-09-12T08:30:00.000Z"],
    ["2026-10-03T11:00:00Z", false, "2026-10-04T07:30:00.000Z"],
    ["2026-04-04T11:00:00Z", false, "2026-04-05T08:30:00.000Z"],
  ])("finds the evening window from %s", (time, tomorrow, expected) => {
    const w = nextReelWindow(new Date(time), tomorrow);
    expect(w.start).toBe(expected);
    expect(Date.parse(w.end) - Date.parse(w.start)).toBe(90 * 60_000);
  });
  it("separates selection, publication and a possible window", () => {
    const now = new Date("2026-09-11T01:00:00Z");
    const scheduled = describeReelPlan({ state: "scheduled", candidate }, true, true, now);
    expect(scheduled.selectedTopic).toBe("Housing");
    expect(scheduled.confirmedPostId).toBeNull();
    expect(scheduled.earliestCheckAt).toBe("2026-09-11T08:30:00.000Z");
    expect(scheduled.timingNote).toContain("not a reserved posting time");
    for (const state of ["locked", "unavailable", "no-evidence", "published"])
      expect(describeReelPlan({ state, candidate }, true, true, now).selectedTopic).toBeNull();
    for (const state of ["locked", "unavailable", "running", "daily-limit", "paused"])
      expect(describeReelPlan({ state, candidate }, true, true, now).earliestCheckAt).toBeNull();
    expect(
      describeReelPlan({ state: "scheduled", candidate }, false, true, now).blockers
    ).toContain("Automatic scheduling is disabled.");
    expect(
      describeReelPlan({ state: "scheduled", candidate }, true, false, now).earliestCheckAt
    ).toBeNull();
  });
  it("keeps a retry outside tonight's window until the next window", () => {
    const result = describeReelPlan(
      { state: "retrying", candidate, retryAt: new Date("2026-09-11T10:05:00Z") },
      true,
      true,
      new Date("2026-09-11T09:50:00Z")
    );
    expect(result.earliestCheckAt).toBe("2026-09-12T08:30:00.000Z");
  });
});
