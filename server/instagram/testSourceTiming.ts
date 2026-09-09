import type { SourceTiming } from "../../shared/sourceTiming";
/** Explicit test provenance; production legacy records remain null. */
export function testSourceTiming(feedDate = "2026-09-08"): SourceTiming {
  return {
    feedReportedAt: `${feedDate}T00:00:00.000Z`,
    publisherPublishedAt: `${feedDate}T00:00:00.000Z`,
    publisherDateStatus: "available",
    retrievedAt: `${feedDate}T00:10:00.000Z`,
  };
}
