import { expect, it } from "vitest";
import { briefingNewsHold } from "./newsEligibility";
import type { FetchedItem } from "./rss";
const now = new Date("2026-09-09T00:00:00Z");
const item: FetchedItem = {
  title: "Sydney housing approvals rise",
  summary: "Supply update",
  source: "ABS",
  url: "https://www.abs.gov.au/report",
  category: "PROPERTY",
  channel: "AU",
  imageUrl: null,
  isoDate: "2026-09-08T00:00:00Z",
};
it("holds undated and old flagship/property inputs before the expensive pipeline", () => {
  for (const channel of ["AU", "PROPERTY"])
    for (const isoDate of [null, "2026-05-01T00:00:00Z"])
      expect(briefingNewsHold({ ...item, channel, isoDate }, now)).toBe("missing-or-old-feed-date");
  expect(briefingNewsHold(item, now)).toBeNull();
  expect(briefingNewsHold({ ...item, source: "Google News" }, now)).toBe("unattributed-search");
});
it("keeps the independent coverage-lane policy separate", () => {
  expect(briefingNewsHold({ ...item, channel: "TECH", isoDate: null }, now)).toBeNull();
});
