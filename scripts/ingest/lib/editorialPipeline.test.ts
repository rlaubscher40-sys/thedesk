import { describe, expect, it, vi } from "vitest";
import { buildDailyBrief } from "./editorialPipeline";
import { assessStory, editorialReportSchema, publisherWeight } from "../../../shared/editorial";
import { parseIndexSource } from "./indexSource";
import { extractPublicationDate } from "./publicationDate";
import { sourceTimingHold, sourceTimingLabel } from "../../../shared/sourceTiming";
import { clusterByTitle } from "./cluster";
import type { FetchedItem } from "./rss";
import type { Source } from "../sources";

const now = new Date("2026-09-10T02:00:00Z");
const published = "2026-09-09T01:00:00Z";
// Synthetic reporting fixture, not a quotation or a live economic claim.
const body = `Australian housing supply has failed to keep pace with demand in several capital cities. New dwelling approvals fell in the latest monthly release, while rental vacancies remained low. The release compares houses and apartments and separates private construction from public housing projects.

The agency said the monthly figures should be read alongside the longer trend because approvals can move sharply when a large apartment project receives permission. Approval is an early step in the construction process and does not establish when a completed home will be available for occupation.

For Australian renters and buyers, the immediate issue is the limited number of homes coming onto the market. Higher building costs and financing constraints continue to affect development. The report does not forecast a specific change in interest rates or establish that every suburb will experience the same price movement.`;
const source: Source = {
  name: "Australian newsroom",
  url: "https://www.abc.net.au/feed",
  category: "PROPERTY",
  channel: "PROPERTY",
};
function item(over: Partial<FetchedItem> = {}): FetchedItem {
  return {
    title: "Australian dwelling approvals fall as housing supply tightens",
    source: "ABC",
    url: "https://www.abc.net.au/news/approvals",
    category: "PROPERTY",
    channel: "PROPERTY",
    summary: "New Australian housing figures show fewer homes approved.",
    isoDate: published,
    imageUrl: null,
    ...over,
  };
}
const timing = {
  feedReportedAt: published,
  publisherPublishedAt: published,
  publisherDateStatus: "available" as const,
  retrievedAt: now.toISOString(),
};
const article = {
  text: body,
  imageUrl: null,
  publicationDate: { publisherPublishedAt: published, publisherDateStatus: "available" as const },
};
function preview(items: FetchedItem[], overrides: Parameters<typeof buildDailyBrief>[0] = {}) {
  return buildDailyBrief({
    sources: [source],
    now,
    readSource: async () => ({ items, fetched: items.length, error: null }),
    readArticle: async () => article,
    resolve: async (url) => url,
    ...overrides,
  });
}

describe("editorial regression benchmark", () => {
  it.each([
    [
      "Home prices fall in most major US cities as housing market cools: See where",
      "https://www.foxbusiness.com/economy/us-home-prices",
      "outside-australian-brief",
    ],
    [
      "Temporary traffic changes on Treasury Place",
      "https://www.treasury.act.gov.au/traffic",
      "traffic-not-housing",
    ],
    [
      "Inside a luxury mansion for sale in Sydney",
      "https://www.realestate.com.au/news/mansion",
      "individual-property-promotion",
    ],
    ["Tender Details", "https://www.tenders.vic.gov.au/tender/details/roof", "reference-page"],
    [
      "Edgecliff planning proposal",
      "https://www.planning.nsw.gov.au/plans-in-nsw/edgecliff",
      "reference-or-listing",
    ],
  ])("holds audited failure: %s", (title, url, reason) => {
    expect(
      assessStory({ ...item({ title, url }), articleText: body, sourceTiming: timing }, now).reason
    ).toBe(reason);
  });
  it("does not turn a fresh search result into proof that a static page was published today", () => {
    expect(
      assessStory(
        {
          ...item(),
          articleText: body,
          sourceTiming: { ...timing, publisherPublishedAt: null, publisherDateStatus: "missing" },
        },
        now
      ).reason
    ).toBe("unconfirmed-publication-date");
    expect(
      assessStory(
        {
          ...item(),
          articleText: body,
          sourceTiming: { ...timing, publisherPublishedAt: "2026-04-01T01:00:00Z" },
        },
        now
      ).eligible
    ).toBe(false);
  });
  it("finds the important twentieth story before applying publisher quotas", async () => {
    const candidates = Array.from({ length: 19 }, (_, n) =>
      item({
        title: `Temporary traffic changes on Treasury Place ${n}`,
        url: `https://www.abc.net.au/news/traffic-${n}`,
      })
    );
    const read = vi.fn(async () => article);
    const result = await preview([...candidates, item()], { readArticle: read });
    expect(result.items.map((i) => i.title)).toEqual([item().title]);
    expect(read).toHaveBeenCalledOnce();
    expect(result.report.discovered).toBe(20);
    expect(editorialReportSchema.safeParse(result.report).success).toBe(true);
  });
  it("replaces an unreadable headline with readable reporting on the same event", async () => {
    const thin = item({ source: "AFR", url: "https://www.afr.com/property/approvals" });
    const result = await preview([thin, item()], {
      readArticle: async (url) => ({
        ...article,
        text: url.includes("afr.com") ? body.slice(0, 553) : body,
      }),
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.source).toBe("ABC");
    expect(result.report.decisions.find((d) => d.source === "AFR")?.reason).toBe(
      "insufficient-article-text"
    );
  });
  it("brings hourly evidence into selection and does not republish it on the next run", async () => {
    const pool = item({ discovery: "evidence-pool" });
    const first = await preview([], { extraCandidates: [pool] });
    expect(first.items).toHaveLength(1);
    expect(first.report.evidencePool).toBe(1);
    const second = await preview([], { extraCandidates: [pool], recentUrls: [pool.url!] });
    expect(second.items).toHaveLength(0);
    expect(second.report.read).toBe(0);
  });
  it("records broken feeds and failed article reads while continuing healthy sources", async () => {
    const result = await preview([], {
      sources: [source, { ...source, name: "Broken" }],
      readSource: async (s) => {
        if (s.name === "Broken") throw new Error("404");
        return { items: [item()], fetched: 1, error: null };
      },
      readArticle: async () => {
        throw new Error("timeout");
      },
    });
    expect(result.items).toHaveLength(0);
    expect(result.report.sources[1]!.error).toBeTruthy();
    expect(result.report.decisions[0]).toMatchObject({
      reason: "article-fetch-failed",
      readAttempted: true,
    });
  });
  it("does not give a query called Treasury a primary-source bonus", () => {
    expect(
      publisherWeight({
        title: "Housing supply",
        source: "Treasury RBA ABS",
        url: "https://example.com/story",
      })
    ).toBe(0);
    expect(
      publisherWeight({
        title: "Housing supply",
        source: "News",
        url: "https://www.abs.gov.au/story",
      })
    ).toBe(16);
    expect(
      publisherWeight({ title: "Housing supply", url: "https://abs.gov.au.example.com/story" })
    ).toBe(0);
  });
  it("keeps tax, super and markets reporting in the professional briefing", () => {
    for (const title of [
      "Australian superannuation contribution caps change",
      "Australian income tax reform announced",
      "ASX shares fall after new Australian company results",
    ]) {
      const result = assessStory(
        {
          ...item({ title, channel: "AU", summary: "" }),
          articleText: title + ". " + body,
          sourceTiming: timing,
        },
        now
      );
      expect(result.eligible, title).toBe(true);
      expect(["POLICY", "MARKETS"]).toContain(result.category);
    }
  });
  it("does not apply Australian topic exclusions to world coverage", () => {
    expect(
      assessStory(
        {
          ...item({ title: "Shooting prompts emergency response overseas", channel: "GLOBAL" }),
          articleText: body,
          sourceTiming: timing,
        },
        now
      ).eligible
    ).toBe(true);
  });
  it("does not count two feeds from one publisher as independent corroboration", () => {
    const clusters = clusterByTitle([
      item({ source: "ABC Business" }),
      item({ source: "ABC Housing", url: "https://abc.net.au/news/approvals-alias" }),
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.corroborationCount).toBe(1);
  });
});

describe("primary publisher discovery and date precision", () => {
  it("discovers current RBA interviews even when the RSS feed omits them", () => {
    const rba: Source = {
      name: "RBA",
      url: "https://www.rba.gov.au/speeches/2026/",
      kind: "index",
      articlePath: "^/speeches/2026/sp-[a-z-]+2026-09-08\\.html$",
      category: "MACRO",
      channel: "AU",
    };
    const items = parseIndexSource(
      '<a href="/speeches/2026/sp-dg-2026-09-08.html">Interview with the Deputy Governor</a><a href="https://other.example/speeches/2026/sp-dg-2026-09-08.html">Unrelated external interview</a>',
      rba
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ isoDate: null, discovery: "publisher-index" });
    expect(
      extractPublicationDate(
        '<span itemprop="datePublished"><time datetime="2026-09-08T19:30+10:00">8 September 2026</time></span>'
      )
    ).toMatchObject({
      publisherPublishedAt: "2026-09-08T09:30:00.000Z",
      publisherDateStatus: "available",
    });
  });
  it("preserves ABS day precision without manufacturing a publication time", () => {
    const publicationDate = extractPublicationDate(
      '<div class="field--name-dynamic-twig-fieldnode-release-or-orig-publish">Released 8/09/2026</div>'
    );
    expect(publicationDate).toEqual({
      publisherPublishedAt: null,
      publisherPublishedDay: "2026-09-08",
      publisherDateStatus: "available",
    });
    const value = { ...timing, feedReportedAt: null, ...publicationDate };
    expect(sourceTimingHold(value, now)).toBeNull();
    expect(sourceTimingLabel(value)).toContain("day only");
    expect(sourceTimingHold({ ...value, publisherPublishedDay: "2026-09-11" }, now)).toBeTruthy();
    expect(sourceTimingHold({ ...value, publisherPublishedDay: "2026-08-01" }, now)).toBeTruthy();
  });
});
