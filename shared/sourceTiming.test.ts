import { describe, expect, it } from "vitest";
import {
  datedBriefingHold,
  sourceTimingHold,
  sourceTimingLabel,
  sourceTimingSchema,
  type SourceTiming,
} from "./sourceTiming";
const now = new Date("2026-09-09T00:00:00Z");
const timing: SourceTiming = {
  feedReportedAt: now.toISOString(),
  publisherPublishedAt: now.toISOString(),
  publisherDateStatus: "available",
  retrievedAt: now.toISOString(),
};
describe("source publication timing", () => {
  it("never lets a recent feed date override an old publication date", () => {
    expect(sourceTimingHold({ ...timing, publisherPublishedAt: "2026-04-01T00:00:00Z" }, now)).toBe(
      "old-or-future-publisher-date"
    );
    expect(sourceTimingHold(timing, now)).toBeNull();
  });
  it("holds unknown legacy timing and invalid/conflicting publisher metadata", () => {
    expect(datedBriefingHold(null, "2026-09-09")).toBe("missing-source-timing");
    for (const publisherDateStatus of ["invalid", "conflicting"])
      expect(
        sourceTimingHold({ ...timing, publisherPublishedAt: null, publisherDateStatus }, now)
      ).toBe("unusable-publisher-date");
  });
  it("keeps missing publisher dates explicitly unconfirmed while retaining recent feed evidence", () => {
    const missing: SourceTiming = {
      ...timing,
      publisherPublishedAt: null,
      publisherDateStatus: "missing",
    };
    expect(sourceTimingHold(missing, now)).toBeNull();
    expect(sourceTimingLabel(missing)).toContain("original publication date unconfirmed");
    expect(sourceTimingLabel(null)).toBe("Original publication date not recorded");
  });
  it("does not turn old collected evidence into a new briefing by changing feedDate", () => {
    expect(datedBriefingHold(timing, "")).toBe("source-timing-feed-date-mismatch");
    expect(datedBriefingHold(timing, "2026-09-10")).toBe("source-timing-feed-date-mismatch");
    expect(datedBriefingHold(timing, "2026-09-09")).toBeNull();
  });
  it("uses Sydney date at the daylight-saving boundary", () => {
    const dst = {
      ...timing,
      feedReportedAt: "2026-10-04T13:30:00Z",
      publisherPublishedAt: null,
      publisherDateStatus: "missing" as const,
      retrievedAt: "2026-10-04T13:40:00Z",
    };
    expect(datedBriefingHold(dst, "2026-10-05")).toBeNull();
    expect(datedBriefingHold(dst, "2026-10-04")).toBe("source-timing-feed-date-mismatch");
  });
  it("rejects future dates and inconsistent schema claims", () => {
    expect(sourceTimingHold({ ...timing, publisherPublishedAt: "2026-09-10T00:00:00Z" }, now)).toBe(
      "old-or-future-publisher-date"
    );
    expect(sourceTimingHold({ ...timing, retrievedAt: "2026-09-10T00:00:00Z" }, now)).toBe(
      "invalid-retrieval-date"
    );
    expect(
      sourceTimingSchema.safeParse({ ...timing, publisherDateStatus: "missing" }).success
    ).toBe(false);
  });
});
