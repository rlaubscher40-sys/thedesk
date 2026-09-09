import { expect, it } from "vitest";
import { unseenFeedItems } from "./feedDedupe";

it("skips an already stored URL despite tracking parameters or fragment changes", () => {
  expect(
    unseenFeedItems(
      [{ title: "Updated headline", sourceUrl: "https://news.test/Story?id=2&utm_source=ig#read" }],
      new Set(["https://news.test/Story?fbclid=old&id=2"])
    )
  ).toEqual([]);
});
it("deduplicates one submission before any items reach insertion or AI", () => {
  const first = { title: "Story", sourceUrl: "https://news.test/Story?id=2" };
  expect(
    unseenFeedItems(
      [first, { ...first, sourceUrl: first.sourceUrl + "&utm_campaign=repeat" }],
      new Set()
    )
  ).toEqual([first]);
});
it("retains distinct article IDs, versions and case-sensitive paths", () => {
  const items = [
    "https://news.test/Story?id=2",
    "https://news.test/Story?id=3",
    "https://news.test/story?id=2",
    "https://news.test/Story?id=2&version=2",
  ].map((sourceUrl) => ({ title: "Similar headline", sourceUrl }));
  expect(unseenFeedItems(items, new Set())).toEqual(items);
});
it("only collapses exact normalised headline repeats within a URL-less batch", () => {
  expect(
    unseenFeedItems(
      [
        { title: "Same story", sourceUrl: null },
        { title: " Same   story ", sourceUrl: null },
        { title: "New development", sourceUrl: null },
      ],
      new Set()
    )
  ).toHaveLength(2);
});
