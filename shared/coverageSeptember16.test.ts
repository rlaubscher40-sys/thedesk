import { expect, it } from "vitest";
import { readingBudget } from "../scripts/ingest/lib/editorialPipeline";
import { extractArticleText } from "../scripts/ingest/lib/article";
import { extractPublicationDate } from "../scripts/ingest/lib/publicationDate";
import { nonNewsFormatHold } from "./editorialPageTypes";
import { reportingExcerpt } from "./reportingExcerpt";
import { storySignificance } from "./editorialSignificance";
import { auditedRecordCorrections } from "./auditedRecordCorrections";
import { relatedCoverageParent } from "./relatedCoverage";
import type { FetchedItem } from "../scripts/ingest/lib/rss";

it("reads the economic release before a publisher's routine stories consume its opportunity", () => {
  const make = (title: string, source: string): FetchedItem => ({
    title,
    source,
    category: "MACRO",
    channel: "AU",
    url: "https://www.brokernews.com.au/" + title,
    summary: "",
    imageUrl: null,
    isoDate: "2026-09-16T01:00:00Z",
  });
  const routine = [
    make("A broker partners with a lender", "Broker"),
    make("Another broker partners with a lender", "Broker"),
    make("New mortgage product launch", "Other"),
  ];
  const release = make("Westpac's Leading Index points to improving, if soft, growth", "Broker");
  const read = readingBudget([...routine, release], 3);
  expect(read).toHaveLength(3);
  expect(read[0]).toBe(release);
  expect(new Set(read).size).toBe(3);
  expect(read.some((r) => r.source === "Other")).toBe(true);
  expect(storySignificance("Westpac forecasts stronger economic growth").baseline).toBeLessThan(
    storySignificance(release.title).baseline
  );
});

it.each([
  "Brisbane couple lists hospital laundry turned family home to downsize",
  "How former renter built off-grid tiny home to escape bills",
])("holds audited individual-property formats: %s", (title) => {
  expect(nonNewsFormatHold({ title })).toBe("individual-property-promotion");
});
it.each([
  "Couple sells home after landmark court ruling on defective cladding",
  "New housing laws improve renters' rights",
  "Housing approvals granted for 95 homes in Bega",
])("retains substantive consequences: %s", (title) =>
  expect(nonNewsFormatHold({ title })).toBeNull()
);

it("does not turn caption sentences into source summaries or fallback evidence", () => {
  const caption = "Melbourne homeowners benefited from visitors. Picture: Example photographer.";
  const body =
    "Melbourne rental searches increased around the event, according to the accommodation platform's figures.";
  expect(reportingExcerpt("Melbourne rental searches increase", caption + "\n\n" + body)).toBe(
    body
  );
  expect(extractArticleText(`<article><p>${caption}</p></article>`, 6000)).toBeNull();
  expect(
    extractArticleText(
      `<article><p>Renders for one bedroom terrace homes in Queensland</p><p>${body}</p></article>`,
      6000
    )
  ).toBe(body);
});

it("keeps only declared Westpac reporting containers, excluding institutional disclaimers", () => {
  const lead =
    "The Leading Index improved in August but remained below trend across its latest components.";
  const finding =
    "Momentum improved from July, while the report warned some of the improvement might not last.";
  const html = `<div class="article-header-detail"><p>${lead}</p></div><div class="bodycopy"><li>${finding}</li></div><div><p>Institutional legal disclaimer containing billions of assets and forecasts.</p></div>`;
  expect(
    extractArticleText(html, 6000, "https://www.westpaciq.com.au/economics/2026/09/release")
  ).toBe(lead + "\n\n" + finding);
  expect(
    extractArticleText(
      "<p>Unrecognised template with unrelated legal claims and finance data.</p>",
      6000,
      "https://www.westpaciq.com.au/economics/2026/09/release"
    )
  ).toBeNull();
});

it("accepts only CPA's standalone declared release date, with day precision", () => {
  const url = "https://www.cpaaustralia.com.au/about-cpa-australia/media/media-releases/example";
  const html = '<meta name="description" content="16 September 2026 ">';
  expect(extractPublicationDate(html, url)).toMatchObject({
    publisherPublishedDay: "2026-09-16",
    publisherPublishedAt: null,
    publisherDateStatus: "available",
  });
  expect(extractPublicationDate(html, "https://example.com/article").publisherDateStatus).toBe(
    "missing"
  );
  expect(
    extractPublicationDate(
      '<meta name="description" content="Report covering 16 September 2026">',
      url
    ).publisherDateStatus
  ).toBe("missing");
});

it("reads CBA's dated closing report without adjacent overseas market cards", () => {
  const url = "https://www.commbank.com.au/articles/newsroom/2026/09/asx-close-example.html";
  const body =
    "Australian shares finished the session higher as miners recovered from recent losses.";
  const html = `<p class="article-upload-date">16\n September 2026</p><div class="article-text"><p>${body}</p></div><div><p>Wall Street prices fell as overseas interest rate expectations changed.</p></div>`;
  expect(extractPublicationDate(html, url)).toMatchObject({
    publisherPublishedDay: "2026-09-16",
    publisherPublishedAt: null,
  });
  expect(extractArticleText(html, 6000, url)).toBe(body);
  expect(storySignificance("Mining rebound helps Australian shares creep higher").baseline).toBe(
    88
  );
  expect(storySignificance("ASX expected to close higher").baseline).toBe(74);
});

it("repairs only the verified old caption on its exact published record", () => {
  const row = {
    sourceUrl:
      "https://www.realestate.com.au/news/queensland-developers-tackle-housing-crisis-with-unconventional-homes-for-first-home-buyers/",
    feedDate: "2026-09-16",
    summary:
      "Renders for one bedroom terrace homes by Azure Group at its The Arbory development on the Sunshine Coast",
  };
  expect(auditedRecordCorrections(row)[0]?.after).toContain("council assessment");
  expect(auditedRecordCorrections({ ...row, summary: "Ruben's revised summary" })).toEqual([]);
  expect(auditedRecordCorrections({ ...row, feedDate: "2026-09-15" })).toEqual([]);
});

it("links rewritten reporting only with matching named series, reporting period and figures", () => {
  const timing = {
    publisherDateStatus: "available" as const,
    publisherPublishedAt: null,
    publisherPublishedDay: "2026-09-15",
    feedReportedAt: null,
    retrievedAt: "2026-09-15T10:00:00Z",
  };
  const parent = {
    id: 1,
    title: "New home sales plunge",
    summary: "HIA reports new home sales fell 10% in August.",
    channel: "PROPERTY",
    sourceTiming: timing,
  };
  const child = {
    id: 2,
    title: "Fresh warning against another rate rise",
    articleText:
      "The Housing Industry Association reports new home sales fell 10 per cent in August.",
    channel: "PROPERTY",
    sourceTiming: timing,
  };
  expect(relatedCoverageParent(child, [parent])?.id).toBe(1);
  expect(
    relatedCoverageParent({ ...child, articleText: child.articleText.replace("August", "July") }, [
      parent,
    ])
  ).toBeNull();
  expect(
    relatedCoverageParent(
      { ...child, articleText: child.articleText.replace("10 per cent", "12 per cent") },
      [parent]
    )
  ).toBeNull();
  expect(
    relatedCoverageParent(
      { ...child, sourceTiming: { ...timing, publisherPublishedDay: "2026-09-16" } },
      [parent]
    )
  ).toBeNull();
});
