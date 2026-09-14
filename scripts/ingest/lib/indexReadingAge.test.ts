import { expect, it } from "vitest";
import { olderIndexPath } from "./indexReadingAge";
import type { FetchedItem } from "./rss";

const now = new Date("2026-09-14T11:00:00Z");
const item: FetchedItem = {
  title: "Mortgage competition heats up",
  url: "https://www.abc.net.au/news/2026-08-19/loan-fraud/123",
  source: "ABC Mortgages", category: "PROPERTY", channel: "PROPERTY",
  summary: "", isoDate: null, imageUrl: null, discovery: "publisher-index",
};
it("uses old ABC index paths only as a reading-order hint", () => {
  expect(olderIndexPath(item, now)).toBe(true);
  expect(item.isoDate).toBeNull();
  for (const day of ["2026-09-10", "2026-09-14", "2026-09-15", "2026-02-30"])
    expect(olderIndexPath({ ...item, url: `https://www.abc.net.au/news/${day}/mortgages/123` }, now)).toBe(false);
});
it("does not override feed dates or infer dates for other publishers or paths", () => {
  expect(olderIndexPath({ ...item, isoDate: now.toISOString() }, now)).toBe(false);
  expect(olderIndexPath({ ...item, discovery: undefined }, now)).toBe(false);
  for (const url of [null, "invalid", "https://example.com/news/2026-08-19/a/123", "https://www.abc.net.au/news/topic/2026-08-19"])
    expect(olderIndexPath({ ...item, url }, now)).toBe(false);
});
