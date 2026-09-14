import { expect, it } from "vitest";
import { editorialDecisionLog } from "./editorialDecisionLog";

it("logs bounded operational evidence without query strings or arbitrary fields", () => {
  const row = { url: "https://www.abc.net.au/news/story?token=private#fragment", reason: "selected", selected: true, readAttempted: true, articleText: "private article", note: "user note" };
  expect(editorialDecisionLog(row)).toEqual({ url: "https://www.abc.net.au/news/story", reason: "selected", selected: true, readAttempted: true });
  expect(editorialDecisionLog({ sourceUrl: row.url, reason: "thin-extract" })).toEqual({ url: "https://www.abc.net.au/news/story", reason: "thin-extract" });
});
it("does not log credentials or non-http URLs", () => {
  for (const url of ["https://user:password@example.com/story", "file:///secrets", "invalid", null])
    expect(editorialDecisionLog({ url, reason: "failed" }).url).toBeNull();
  expect(editorialDecisionLog({ reason: "a".repeat(500) }).reason).toHaveLength(128);
});
