import { describe, expect, it } from "vitest";
import { articleIdentity, dedupeArticles } from "./dedupe";
import type { FetchedItem } from "./rss";

const item = (url: string | null, title = "Housing approvals fall again"): FetchedItem => ({
  url,
  title,
  source: "ABS",
  channel: "PROPERTY",
  category: "PROPERTY",
  summary: title,
  imageUrl: null,
  isoDate: null,
});
describe("article URL identity", () => {
  it("collapses tracking links and fragments but retains content IDs", () => {
    const a = item("https://example.com/article?id=1&utm_source=rss#details");
    const b = item("https://example.com/article?fbclid=123&id=1");
    expect(dedupeArticles([a, b, item("https://example.com/article?id=2")])).toHaveLength(2);
  });
  it("preserves path and query-value case and normalises query order", () => {
    expect(
      dedupeArticles([item("https://example.com/Article"), item("https://example.com/article")])
    ).toHaveLength(2);
    expect(
      dedupeArticles([item("https://example.com/?id=ABC"), item("https://example.com/?id=abc")])
    ).toHaveLength(2);
    expect(articleIdentity(item("https://example.com/?a=1&b=2"))).toBe(
      articleIdentity(item("https://EXAMPLE.com/?b=2&a=1"))
    );
  });
  it("keeps a meaningful question or hash in URL-less headlines", () => {
    expect(
      dedupeArticles([
        item(null, "Housing: what next? Rates rise"),
        item(null, "Housing: what next? Rates fall"),
      ])
    ).toHaveLength(2);
    expect(
      dedupeArticles([item(null, "  Housing   approvals  "), item(null, "housing approvals")])
    ).toHaveLength(1);
  });
});
