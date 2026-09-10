import { describe, expect, it } from "vitest";
import { extractPublicationDate } from "./publicationDate";
const date = "2026-09-08T10:00:00+10:00";
const meta = (value: string) => `<meta content="${value}" property="article:published_time">`;
const ld = (value: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
describe("publisher-declared publication dates", () => {
  it("normalizes metadata without replacing the original with a modified date", () => {
    expect(
      extractPublicationDate(
        meta(date) + '<meta property="article:modified_time" content="2026-09-09T00:00:00Z">'
      )
    ).toEqual({
      publisherPublishedAt: "2026-09-08T00:00:00.000Z",
      publisherDateStatus: "available",
    });
  });
  it("reads article JSON-LD roots and graphs but ignores nested related articles", () => {
    expect(
      extractPublicationDate(
        ld({
          "@graph": [
            {
              "@type": ["Thing", "NewsArticle"],
              datePublished: date,
              relatedLink: { "@type": "Article", datePublished: "2026-04-01" },
            },
          ],
        })
      )
    ).toMatchObject({ publisherDateStatus: "available" });
    expect(extractPublicationDate(ld({ "@type": "WebPage", datePublished: date }))).toMatchObject({
      publisherDateStatus: "missing",
    });
  });
  it("holds contradictory values, accepting equivalent timezone representations", () => {
    expect(
      extractPublicationDate(
        meta(date) + ld({ "@type": "Article", datePublished: "2026-09-08T00:00:00Z" })
      )
    ).toMatchObject({ publisherDateStatus: "available" });
    expect(
      extractPublicationDate(
        meta(date) + ld({ "@type": "Article", datePublished: "2026-04-01T00:00:00Z" })
      )
    ).toMatchObject({ publisherDateStatus: "conflicting", publisherPublishedAt: null });
  });
  it.each([ "2026-02-30T00:00:00Z", "tomorrow", ""])(
    "does not invent a date or timezone for %j",
    (value) => {
      expect(extractPublicationDate(meta(value))).toMatchObject({ publisherDateStatus: "invalid" });
    }
  );
  it("retains only day precision when publisher clocks disagree within the same day", () => {
    expect(extractPublicationDate(meta("2026-09-10T15:04:47+00:00") + ld({ "@type": "NewsArticle", datePublished: "2026-09-10T05:04:47Z" }))).toEqual({ publisherPublishedAt: null, publisherPublishedDay: "2026-09-10", publisherDateStatus: "available" });
    expect(extractPublicationDate(meta("2026-09-09T20:50:09+1000") + ld({ "@type": "NewsArticle", datePublished: "2026-09-09 20:50:09" }))).toEqual({ publisherPublishedAt: null, publisherPublishedDay: "2026-09-09", publisherDateStatus: "available" });
    expect(extractPublicationDate(meta("2026-09-08"))).toEqual({ publisherPublishedAt: null, publisherPublishedDay: "2026-09-08", publisherDateStatus: "available" });
  });
  it("does not use visible dates, comments, or modified-only metadata", () => {
    expect(
      extractPublicationDate(
        `<!--${meta(date)}--><time>${date}</time>` + ld({ "@type": "Article", dateModified: date })
      )
    ).toMatchObject({ publisherDateStatus: "missing" });
  });
  it("bounds graph traversal and holds malformed JSON", () => {
    expect(extractPublicationDate(ld(Array.from({ length: 201 }, () => ({}))))).toMatchObject({
      publisherDateStatus: "invalid",
    });
    expect(
      extractPublicationDate('<script type="application/ld+json">broken</script>')
    ).toMatchObject({ publisherDateStatus: "invalid" });
  });
});
