import { expect, it } from "vitest";
import { sourceWebsite } from "./sourceIdentity";
it("resolves attributed Google references without counting the aggregator", () => {
  expect(sourceWebsite("https://news.google.com/rss/a", "ABC News")).toBeNull(); // Ambiguous US/Australian masthead.
  expect(
    sourceWebsite("https://news.google.com/rss/a", "Australian Broadcasting Corporation")
  ).toBe("abc.net.au");
  expect(sourceWebsite("https://www.abc.net.au/a", "Different label")).toBe("abc.net.au");
  expect(sourceWebsite("https://news.google.com/rss/b", "Newcastle Herald")).toBe(
    "newcastleherald.com.au"
  );
  expect(sourceWebsite("https://news.google.com/rss/c", "Unresolved publisher")).toBeNull();
  expect(sourceWebsite("https://secret:password@publisher.com/a", "Publisher")).toBeNull();
});
