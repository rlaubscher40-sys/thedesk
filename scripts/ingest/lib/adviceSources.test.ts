import { afterEach, expect, it, vi } from "vitest";
import { SOURCES } from "../sources";
import { extractArticleText, fetchArticle } from "./article";
import { publisherAccessPause } from "./articleAccess";
import { articleDisclosureHold } from "./articleDisclosure";
import { extractPublicationDate } from "./publicationDate";
import { buildDailyBrief } from "./editorialPipeline";
import { createSourceReader } from "./rss";
vi.mock("./publicFetch", () => ({
  publicFetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
}));
afterEach(() => vi.unstubAllGlobals());

const url = "https://www.moneymanagement.com.au/australian-advice-rules/";
const paused = "https://www.professionalplanner.com.au/2026/09/australian-advice-rules/";
const now = new Date("2026-09-14T13:00:00Z");
const published = "2026-09-13T20:30:02.000Z";
// Synthetic reporting and markup model the checked publisher template.
const body =
  "ASIC announced a 5-year ban on an Australian financial adviser after reviewing superannuation switching advice. The decision concerns the adviser's responsibility to assess each client's circumstances and explain the costs of the proposed transaction. The regulator said advisers must retain responsibility for advice supplied through third parties. The findings do not establish that all financial advice firms have breached the rules. ".repeat(
    3
  );
const schema = (date: string, section = "Financial Planning", target = url) =>
  `<script type="application/ld+json">${JSON.stringify({ "@graph": [{ "@type": "Article", "@id": target + "#article", datePublished: date, articleSection: [section] }] })}</script>`;

it("reads the replacement feed with its own attribution and excludes the paused direct source", async () => {
  expect(SOURCES.some((s) => s.name === "Professional Planner")).toBe(false);
  const source = SOURCES.find((s) => s.name === "Money Management")!;
  const read = createSourceReader(
    async () =>
      `<rss version="2.0"><channel><title>Money Management</title><item><title>ASIC bans Australian financial adviser over superannuation advice</title><link>${url}</link><pubDate>Mon, 14 Sep 2026 06:30:02 +1000</pubDate></item></channel></rss>`
  );
  expect((await read(source)).items[0]).toMatchObject({
    source: "Money Management",
    url,
    isoDate: published,
  });
  expect(SOURCES.some((s) => s.name === "ASIC Media Releases")).toBe(true);
  expect(SOURCES.some((s) => s.name === "Financial Advice Association Australia")).toBe(true);
});

it("keeps a publisher pause across new access instances without requesting the article", async () => {
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  expect((await fetchArticle(paused)).fetchFailure).toBe("article-source-paused");
  expect(publisherAccessPause("https://professionalplanner.com.au/another-story")).toBe(
    "article-source-paused"
  );
  expect(publisherAccessPause("https://news.professionalplanner.com.au/story")).toBe(
    "article-source-paused"
  );
  expect(publisherAccessPause("https://professionalplanner.com.au.example.org/story")).toBeNull();
  expect(publisherAccessPause(url)).toBeNull();
  expect(request).not.toHaveBeenCalled();
});

it("uses accessible reporting of the event when a direct or resolved candidate is paused", async () => {
  const google = "https://news.google.com/rss/articles/paused-story";
  const item = {
    source: "Professional Planner",
    title: "ASIC bans Australian financial adviser over superannuation advice",
    category: "POLICY",
    channel: "AU",
    summary: "",
    imageUrl: null,
    isoDate: published,
  };
  const readArticle = vi.fn(async () => ({
    text: body,
    imageUrl: null,
    publicationDate: { publisherPublishedAt: published, publisherDateStatus: "available" as const },
  }));
  const result = await buildDailyBrief({
    now,
    sources: [],
    extraCandidates: [
      { ...item, url: paused },
      { ...item, url: google },
      { ...item, source: "Money Management", url },
    ],
    resolve: async (u) => (u === google ? paused : u),
    readArticle,
  });
  expect(readArticle).toHaveBeenCalledExactlyOnceWith(url);
  expect(result.report.decisions.find((d) => d.source === "Money Management")?.reason).toBe(
    "selected"
  );
  expect(result.items).toHaveLength(1);
  expect(result.items[0]).toMatchObject({
    url,
    source: "Money Management",
    corroborationCount: 1,
    channel: "AU",
  });
  expect(result.report.decisions.filter((d) => d.reason === "article-source-paused")).toHaveLength(
    2
  );
  expect(
    result.report.decisions
      .filter((d) => d.reason === "article-source-paused")
      .every((d) => !d.readAttempted)
  ).toBe(true);
});

it("reads the declared post body, excluding related cards, comments and preferred-source promotion", () => {
  const html = `<article><p>Related Australian mortgage article that must not be used as the body.</p></article><div class="entry-content"><p>${body}</p><p>If you enjoyed this article, why not select Money Management as a preferred source in Google?</p></div><div id="comments"><p>Readers suggest unrelated financial advice and make unverified accusations.</p></div>`;
  expect(extractArticleText(html, 6000, url)).toBe(body.trim());
  expect(extractArticleText(`<article><p>${body}</p></article>`, 6000, url)).toBeNull();
});

it.each([
  ["2026-09-14 06:30:02Australia/Melbourne", published],
  ["2026-12-14 06:30:02Australia/Melbourne", "2026-12-13T19:30:02.000Z"],
])(
  "reconciles the publisher's explicit Melbourne clock with its ISO declaration: %s",
  (local, utc) => {
    expect(
      extractPublicationDate(
        `<meta property="article:published_time" content="${utc}">${schema(local)}`,
        url
      )
    ).toMatchObject({ publisherDateStatus: "available", publisherPublishedAt: utc });
  }
);

it.each([
  "2026-10-04 02:30:00Australia/Melbourne",
  "2026-04-05 02:30:00Australia/Melbourne",
  "2026-02-30 06:30:00Australia/Melbourne",
])("holds nonexistent, ambiguous or invalid local clocks: %s", (local) => {
  expect(extractPublicationDate(schema(local), url).publisherDateStatus).toBe("invalid");
});

it("does not normalise another publisher or turn a conflicting date into a fresh article", () => {
  expect(
    extractPublicationDate(
      schema("2026-09-14 06:30:02Australia/Melbourne"),
      "https://other.example/story"
    ).publisherDateStatus
  ).toBe("invalid");
  expect(
    extractPublicationDate(
      `<meta property="article:published_time" content="2026-09-10T00:00:00Z">${schema("2026-09-14 06:30:02Australia/Melbourne")}`,
      url
    ).publisherDateStatus
  ).toBe("conflicting");
});

it("holds the current article's promoted-content declaration, not a related advert", () => {
  expect(articleDisclosureHold(schema(published, "Promoted Content"), url)).toBe(
    "publisher-disclosed-sponsored-content"
  );
  expect(
    articleDisclosureHold(
      schema(published, "Promoted Content", "https://www.moneymanagement.com.au/other/"),
      url
    )
  ).toBeNull();
  expect(
    articleDisclosureHold(schema(published) + "<aside>Promoted Content</aside>", url)
  ).toBeNull();
});
