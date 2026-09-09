import { describe, expect, it } from "vitest";
import { propertyNewsHold, recentNewsTimestamp } from "./propertyNewsQuality";

describe("automatic property-news holds", () => {
  it("holds the observed spam/recycled update without condemning ordinary emergency housing reporting", () => {
    expect(
      propertyNewsHold(
        {
          title: "Perth Housing Market Update | April 2026 Emergency Alert Today (7Y9mHxXuGJ)",
          source: "MSHALE",
        },
        "2026-09-09"
      )
    ).toBe("promotional-headline");
    expect(
      propertyNewsHold(
        { title: "Perth housing market update, April 2026", source: "Publisher" },
        "2026-09-09"
      )
    ).toBe("recycled-market-update");
    expect(
      propertyNewsHold(
        { title: "Perth housing market update, August 2026", source: "Publisher" },
        "2026-09-09"
      )
    ).toBeNull();
    expect(
      propertyNewsHold(
        { title: "Sydney emergency housing funded after floods", source: "ABC" },
        "2026-09-09"
      )
    ).toBeNull();
    expect(
      propertyNewsHold(
        { title: "ABS rents in July 2026 compared with July 2025", source: "ABS" },
        "2026-09-09"
      )
    ).toBeNull();
  });
  it("does not treat an uncredited search result or a guaranteed-return pitch as editorial evidence", () => {
    expect(
      propertyNewsHold({ title: "Brisbane housing supply", source: "Google News" }, "2026-09-09")
    ).toBe("unattributed-search");
    expect(
      propertyNewsHold(
        { title: "Sydney property: guaranteed returns", source: "Publisher" },
        "2026-09-09"
      )
    ).toBe("promotional-headline");
  });
  it("holds old month-labelled updates across the year boundary", () => {
    expect(
      propertyNewsHold({ title: "Sydney rental market report October 2026" }, "2027-01-01")
    ).toBe("recycled-market-update");
    expect(
      propertyNewsHold({ title: "Sydney rental market report November 2026" }, "2027-01-01")
    ).toBeNull();
  });
});
describe("feed-supplied news timestamps", () => {
  const now = new Date("2026-09-09T00:00:00Z");
  it("uses the timestamp rather than a current collection date, with a four-day boundary", () => {
    expect(recentNewsTimestamp("2026-02-30T00:00:00Z", new Date("2026-03-03T00:00:00Z"))).toBe(
      false
    );
    expect(recentNewsTimestamp("2026-09-05T00:00:00Z", now)).toBe(true);
    expect(recentNewsTimestamp("2026-09-04T23:59:59Z", now)).toBe(false);
    expect(recentNewsTimestamp("Tue, 08 Sep 2026 10:00:00 GMT", now)).toBe(true);
    expect(recentNewsTimestamp("2026-09-09T09:00:00+10:00", now)).toBe(true);
    for (const value of [
      null,
      "",
      "bad",
      "2026-09-08",
      "2026-09-08T10:00:00",
      "2026-09-09T00:00:01Z",
    ])
      expect(recentNewsTimestamp(value, now)).toBe(false);
  });
});
