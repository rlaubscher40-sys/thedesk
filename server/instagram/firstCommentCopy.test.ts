import { expect, it } from "vitest";
import { buildFirstComment, validateFirstComment } from "./firstCommentCopy";
it.each([
  ["Sydney housing approvals", "approvals, infrastructure"],
  ["Market-rate rentals but no public housing guarantee", "housing mix"],
  ["New rental rights reform", "rental rules"],
  ["Richmond tower plans", "approval stage"],
  ["New home loan rates", "borrowing capacity"],
  ["Home loan approvals", "borrowing capacity"],
  ["Brisbane vs Perth rents", "local rental market"],
  ["Interstate migration", "people move"],
  ["Auction clearance", "pass-ins"],
])("writes a relevant question for %s", (headline, expected) => {
  const text = buildFirstComment({ postType: "reel", headline });
  expect(text).toContain(expected);
  expect(text).toMatch(/\?$/);
  expect(text).not.toMatch(/\d|#|@|https?:|\u2014/);
});
it("keeps unrelated coverage neutral instead of inventing a property angle", () => {
  expect(buildFirstComment({ postType: "coverage", headline: "Technology earnings" })).not.toMatch(
    /property|housing|rents|loans/i
  );
});
it.each([
  "",
  "a".repeat(301),
  "Hello\u2014world",
  "Tag @someone",
  "Visit https://example.com",
  "First\nSecond",
])("rejects unsuitable first comments before a network request", (message) => {
  expect(() => validateFirstComment(message)).toThrow();
});
