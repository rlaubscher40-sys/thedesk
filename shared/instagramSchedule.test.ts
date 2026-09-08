import { describe, expect, it } from "vitest";
import { inReelWindow, sydneySocialClock } from "./instagramSchedule";
describe("Sydney evening window", () => {
  it.each([
    ["2026-09-09T08:29:00Z", false],
    ["2026-09-09T08:30:00Z", true],
    ["2026-09-09T09:59:00Z", true],
    ["2026-09-09T10:00:00Z", false],
    ["2026-12-09T07:29:00Z", false],
    ["2026-12-09T07:30:00Z", true],
    ["2026-12-09T08:59:00Z", true],
    ["2026-12-09T09:00:00Z", false],
  ])("gates %s without a fixed UTC offset", (iso, expected) => {
    expect(inReelWindow(new Date(iso))).toBe(expected);
  });
  it("follows both daylight-saving transitions without changing the local slot", () => {
    for (const iso of [
      "2026-04-04T07:30:00Z",
      "2026-04-05T08:30:00Z",
      "2026-10-03T08:30:00Z",
      "2026-10-04T07:30:00Z",
    ])
      expect(sydneySocialClock(new Date(iso)).minutes).toBe(18 * 60 + 30);
  });
});
