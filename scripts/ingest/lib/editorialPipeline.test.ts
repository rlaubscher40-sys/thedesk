import { describe, expect, it, vi } from "vitest";
import { buildDailyBrief, briefingSummary } from "./editorialPipeline";
import {
  assessStory,
  editorialReportSchema,
  publisherWeight,
  legacyEditorialHold,
} from "../../../shared/editorial";
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
  it("keeps publisher-declared sponsored content out of enrichment", async () => {
    const result = await preview([item()], {
      readArticle: async () => ({
        ...article,
        editorialHold: "publisher-disclosed-sponsored-content",
      }),
    });
    expect(result.items).toHaveLength(0);
    expect(result.report.decisions[0]!.reason).toBe("publisher-disclosed-sponsored-content");
  });
  it("suppresses near-verbatim evidence already published in a previous run", async () => {
    const candidate = item();
    const result = await preview([candidate], {
      recentStories: [
        { ...candidate, title: candidate.title, articleText: body, sourceTiming: timing },
      ],
    });
    expect(result.items).toHaveLength(0);
    expect(result.report.decisions[0]!.reason).toBe("already-covered-evidence");
  });
  it.each([
    "From development to design: What sets this luxury Kangaroo Point landmark apart for buyers",
    "Amid the property gloom comes a snappy $25m sale in Bellevue Hill",
  ])("holds audited individual-property promotion: %s", (title) => {
    expect(legacyEditorialHold({ title })).toBe("individual-property-promotion");
  });
  it("recognises fraudulent lending in the original dek, while requiring Australian evidence", () => {
    const input = {
      ...item({
        title: "Perfect storm: How banks allegedly defrauded of up to $600m",
        summary: "NSW police allege fraudulent loans were used to obtain bank finance.",
      }),
      articleText: body,
      sourceTiming: timing,
    };
    expect(assessStory(input, now).eligible).toBe(true);
    expect(
      assessStory({ ...input, title: "US banks allegedly defrauded of $600m" }, now).eligible
    ).toBe(false);
  });
  it("records total decision count even when early exclusions exceed the retained sample", async () => {
    const items = Array.from({ length: 320 }, (_, i) =>
      item({ url: `https://www.abc.net.au/news/old-${i}`, isoDate: "2025-01-01T00:00:00Z" })
    );
    const result = await preview(items);
    expect(result.report.decisionCount).toBe(320);
    expect(result.report.decisions).toHaveLength(300);
    expect(result.report.read).toBe(0);
  });
  it("distinguishes a publisher reading cap from the overall reading budget", async () => {
    const result = await preview(
      Array.from({ length: 12 }, (_, i) => item({ url: `https://www.abc.net.au/news/story-${i}` }))
    );
    expect(
      result.report.decisions.filter((d) => d.reason === "publisher-reading-limit")
    ).toHaveLength(2);
    expect(result.report.read).toBe(10);
  });
  it("records the publisher publication cap separately from a lane cap", async () => {
    const titles = [
      "Australian mortgage serviceability limits revised",
      "Sydney rental vacancy research released",
      "Melbourne residential construction workforce shortages increase",
      "Brisbane housing supply policy changed",
    ];
    const result = await preview(
      titles.map((title, i) =>
        item({ title, summary: "", url: `https://www.abc.net.au/news/distinct-${i}` })
      )
    );
    expect(result.items).toHaveLength(3);
    expect(
      result.report.decisions.filter((d) => d.reason === "publisher-publication-limit")
    ).toHaveLength(1);
  });
  it.each([
    ["Australian Mortgage Awards 2026: Book your hotel room now", "promotion-or-event-marketing"],
    [
      "Made for $1500, this Australian film takes a swipe at greedy landlords",
      "culture-not-market-reporting",
    ],
    ["9 ASX 200 shares earning strengthened buy ratings this week", "stock-pick-roundup"],
    ["Top 3 ASX 200 shares now below their 200-day moving average", "stock-pick-roundup"],
  ])("holds live rollout failure: %s", (title, reason) => {
    expect(
      assessStory({ ...item({ title }), articleText: body, sourceTiming: timing }, now).reason
    ).toBe(reason);
  });
  it.each([
    "Australia's most expensive homes decline in value",
    "Property experts name spring market winners and losers",
  ])("recognises a housing subject without requiring one exact phrase: %s", (title) => {
    expect(
      assessStory(
        {
          ...item({ title, summary: "New Australian research was released today." }),
          articleText: body,
          sourceTiming: timing,
        },
        now
      ).eligible
    ).toBe(true);
  });
  it("does not borrow housing relevance from unrelated page text", () => {
    expect(
      assessStory(
        {
          ...item({
            title: "Another Australian found safe after Nepal-Tibet floods",
            summary: "An Australian traveller has been found safe following floods.",
          }),
          articleText: body,
          sourceTiming: timing,
        },
        now
      ).reason
    ).toBe("no-property-or-economic-consequence");
  });
  it("routes general broker reporting to Australia, not Property", () => {
    for (const title of [
      "What do mortgage brokers think about diversity, equity and inclusion?",
      "Accountants charged as mortgage fraud arrests hit 33",
    ]) {
      const result = assessStory(
        {
          ...item({ title, summary: "New Australian broker research was released today." }),
          articleText: body,
          sourceTiming: timing,
        },
        now
      );
      expect(result.eligible).toBe(true);
      expect(result.channel).toBe("AU");
    }
  });
  it("does not fill spare slots with a low-priority unreviewed publisher", () => {
    expect(
      assessStory(
        {
          ...item({ url: "https://example.com/housing" }),
          articleText: body,
          sourceTiming: timing,
        },
        now
      ).reason
    ).toBe("unreviewed-publisher");
  });

  it("removes obvious legacy off-beat stories while retaining housing consequences", () => {
    expect(
      legacyEditorialHold({
        title: "True to her own life, a writer leaves a rule to live by",
        summary: "The Australian writer dies aged 82",
      })
    ).toBe("off-topic");
    expect(
      legacyEditorialHold({ title: "Man dies after shooting near community centre in Sydney" })
    ).toBe("off-topic");
    expect(
      legacyEditorialHold({ title: "Golf club rezoning unlocks new housing supply" })
    ).toBeNull();
  });
  it("uses reporting instead of a Google roundup as the published summary", async () => {
    const result = await preview([
      item({
        summary:
          "A headline ABC News Another headline The Guardian See more headlines and perspectives on Google News",
      }),
    ]);
    expect(briefingSummary(result.items[0]!)).toContain("Australian housing supply");
    expect(briefingSummary(result.items[0]!)).not.toContain("Google News");
  });

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
        text: new URL(url).hostname === "www.afr.com" ? body.slice(0, 553) : body,
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
