import { expect, it } from "vitest";
import { extractMarketClose } from "./marketLiveblog";
const url =
  "https://www.abc.net.au/news/2026-09-11/asx-markets-business-news-live-updates/107136846";
const now = new Date("2026-09-12T00:00:00Z");
const post = {
  "@type": "BlogPosting",
  url: url + "#close",
  headline: "ASX ends lower",
  datePublished: "2026-09-11T06:32:00Z",
  articleBody:
    "The Australian share market finished down 0.9% at 8,741 points. " +
    "Materials fell while financials gained during the Australian trading session. ".repeat(12),
};
const html = (updates: unknown[]) =>
  '<script type="application/ld+json">' +
  JSON.stringify({ "@type": "LiveBlogPosting", liveBlogUpdate: updates }) +
  "</script><article><p>Japan is the newest update.</p></article>";
it("selects the actual dated domestic close after overseas updates and sign-offs", () => {
  const result = extractMarketClose(
    html([
      { ...post, headline: "Thanks for joining", datePublished: "2026-09-11T06:55:00Z" },
      { ...post, headline: "Nikkei closes lower" },
      post,
    ]),
    url,
    now
  );
  expect(result?.title).toContain("2026-09-11");
  expect(result?.text).toMatch(/^Market close on 2026-09-11: The Australian/);
  expect(result?.text).not.toContain("Japan");
  expect(result?.publishedAt).toBe("2026-09-11T06:32:00.000Z");
});
it.each([
  { datePublished: "2026-09-10T06:32:00Z" },
  { datePublished: "2026-09-11T03:00:00Z" },
  { datePublished: "2026-09-13T06:32:00Z" },
  { datePublished: "unknown" },
  { url: "https://other.example/story#close" },
  { articleBody: "Markets closed lower." },
  { headline: "ASX expected to close lower" },
])("does not fabricate a close from invalid evidence %j", (change) => {
  expect(extractMarketClose(html([{ ...post, ...change }]), url, now)).toBeNull();
});
it("does not use nested related articles as a closing update", () => {
  expect(
    extractMarketClose(
      '<script type="application/ld+json">' +
        JSON.stringify({
          "@type": "NewsArticle",
          related: JSON.parse(html([post]).match(/>(.*?)<\/script>/)![1]!),
        }) +
        "</script>",
      url,
      now
    )
  ).toBeNull();
});
