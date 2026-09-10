import { describe, expect, it } from "vitest";
import { SOURCES } from "../sources";
import { EVIDENCE_SOURCES } from "../propertySources";
import { assessStory, editorialBeat, publisherWeight } from "../../../shared/editorial";
import { parseIndexSource } from "./indexSource";
import { extractPublicationDate } from "./publicationDate";
import { extractArticleText } from "./article";
import { readingBudget } from "./editorialPipeline";
import type { FetchedItem } from "./rss";
import { australianPropertyTier } from "../../../server/instagram/propertyEditorial";
import { cleanHeadline } from "../../../shared/headline";

// Synthetic fixtures model structures and failure cases observed in the
// 2026-09-10 audit. They do not reproduce publisher reporting or economic data.
const now = new Date("2026-09-10T06:00:00Z");
const body =
  "New Australian research examines the effects of policy changes on households and the supply of homes. The report distinguishes observed data from forecasts and explains the limitations of its findings. ".repeat(
    12
  );
const timing = {
  feedReportedAt: null,
  publisherPublishedAt: null,
  publisherPublishedDay: "2026-09-10",
  publisherDateStatus: "available" as const,
  retrievedAt: now.toISOString(),
};
const apraDate = (label = "Published", date = "10 September 2026") =>
  `<div class="basic-page anx-pill--split"><div class="anx-pill__label-first">${label}</div><div class="anx-pill__label-last">${date}</div></div>`;

describe("source audit regressions", () => {
  it.each([
    ["APRA News", "apra.gov.au", 16],
    ["Cotality Australia", "cotality.com", 12],
    ["Treasury Ministerial Releases", "ministers.treasury.gov.au", 16],
    ["Australian Broker", "brokernews.com.au", 12],
    ["Professional Planner", "professionalplanner.com.au", 12],
    ["Accountants Daily", "accountantsdaily.com.au", 12],
    ["SMSF Association", "smsfassociation.com", 8],
    ["UDIA National", "udia.com.au", 8],
    ["Master Builders Australia", "masterbuilders.com.au", 8],
  ])("registers audited direct discovery and weighting: %s", (name, host, weight) => {
    const source = SOURCES.find((s) => s.name === name)!;
    expect(source).toBeDefined();
    expect(new URL(source.url).hostname.replace(/^www\./, "")).toBe(host);
    expect(publisherWeight({ title: "", sourceUrl: source.url })).toBe(weight);
    expect(
      publisherWeight({ title: "", source: name, sourceUrl: "https://unreviewed.example/story" })
    ).toBe(0);
  });
  it("does not pretend undated indexes entered the hourly excerpt archive", () => {
    expect(EVIDENCE_SOURCES.every((source) => source.kind !== "index")).toBe(true);
    expect(EVIDENCE_SOURCES.some((source) => source.name === "Australian Broker")).toBe(true);
  });
  it("takes the Cotality card heading, not category or button text", () => {
    const source = SOURCES.find((s) => s.name === "Cotality Australia")!;
    const items = parseIndexSource(
      `<a href="/au/insights/articles/new-release"><span>Property market economics</span><h3>Australian housing report released</h3><span>Read now</span></a><a href="/au/insights/analysis/static-reference"><h3>Australian housing reference guide</h3></a><a href="https://other.example/au/insights/articles/new-release"><h3>Unrelated external release</h3></a>`,
      source
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Australian housing report released",
      summary: "",
      isoDate: null,
    });
  });
  it("does not let a card category manufacture subject relevance", () => {
    const source = SOURCES.find((s) => s.name === "Cotality Australia")!;
    const [item] = parseIndexSource(
      '<a href="/au/insights/articles/marketing"><span>Property market economics</span><h3>Build your social media brand today</h3><span>Read now</span></a>',
      source
    );
    expect(editorialBeat(item!.title)).toBeNull();
  });
  it.each([
    "Monthly Housing Chart Pack - September 2026",
    "Exposure draft legislation – Minimum tax on discretionary trusts",
    "Australians want more from their super – and SMSFs are answering the call",
  ])("preserves the publisher's substantive headline suffix: %s", (title) => {
    expect(cleanHeadline(title)).toBe(title);
    expect(cleanHeadline(`${title} - Local Reporting Desk`, "Local Reporting Desk")).toBe(title);
  });
  it.each([
    "meet-an-official",
    "quarterly-superannuation-product-statistics",
    "quarterly-fund-level-statistics",
  ])("does not promote an APRA staff profile or statistics landing page: %s", (path) => {
    expect(
      assessStory(
        {
          title: "Quarterly Superannuation Statistics",
          channel: "AU",
          sourceUrl: `https://www.apra.gov.au/news-and-publications/${path}`,
          articleText: body,
          sourceTiming: timing,
        },
        now
      ).reason
    ).toBe("reference-or-staff-profile");
  });
  it("reads APRA's explicitly labelled original day after a large navigation block", () => {
    expect(
      extractPublicationDate(
        " ".repeat(650_000) + apraDate(),
        "https://www.apra.gov.au/news-and-publications/release"
      )
    ).toEqual({
      publisherPublishedAt: null,
      publisherPublishedDay: "2026-09-10",
      publisherDateStatus: "available",
    });
    expect(
      extractPublicationDate(
        " ".repeat(1024 * 1024) + apraDate(),
        "https://www.apra.gov.au/release"
      ).publisherDateStatus
    ).toBe("missing");
  });
  it("scopes APRA date adaptation and ignores updated/event dates", () => {
    expect(
      extractPublicationDate(apraDate(), "https://unreviewed.example/article").publisherDateStatus
    ).toBe("missing");
    expect(
      extractPublicationDate(apraDate("Updated"), "https://www.apra.gov.au/release")
        .publisherDateStatus
    ).toBe("missing");
    expect(
      extractPublicationDate(
        apraDate("Published", "31 September 2026"),
        "https://www.apra.gov.au/release"
      ).publisherDateStatus
    ).toBe("invalid");
    expect(
      extractPublicationDate(
        apraDate() + apraDate("Published", "9 September 2026"),
        "https://www.apra.gov.au/release"
      ).publisherDateStatus
    ).toBe("conflicting");
  });
  it("reads Treasury's declared day without inventing a clock", () => {
    const html = '<meta name="dcterms.date" content="10 September 2026">';
    expect(
      extractPublicationDate(html, "https://ministers.treasury.gov.au/ministers/release")
    ).toMatchObject({
      publisherPublishedDay: "2026-09-10",
      publisherDateStatus: "available",
      publisherPublishedAt: null,
    });
    expect(extractPublicationDate(html, "https://other.example/release").publisherDateStatus).toBe(
      "missing"
    );
    expect(
      extractPublicationDate(
        html + '<meta property="article:published_time" content="2026-09-09">',
        "https://ministers.treasury.gov.au/release"
      ).publisherDateStatus
    ).toBe("conflicting");
  });
  it("retains research list findings without menu or duplicate paragraph text", () => {
    const finding =
      "The release separates houses and apartments when comparing reported value changes.";
    const html = `<nav><li>Menu text describing research and housing reports must not become article evidence.</li></nav><article><p>The report explains the scope and limitations of its published research.</p><ul><li><p>${finding}</p></li></ul></article>`;
    const text = extractArticleText(html, 6000)!;
    expect(text).toContain(finding);
    expect(text.split(finding)).toHaveLength(2);
    expect(text).not.toContain("Menu text");
  });
  it.each([
    ["New financial advice research examines fee changes", "advice-tax"],
    ["Advice fees rise as firms price for complexity", "advice-tax"],
    ["Federal Court backs ATO on tax residency dispute", "advice-tax"],
    ["Exposure draft legislation: minimum tax on discretionary trusts", "advice-tax"],
    ["Blueprint to rebuild Australia's construction workforce", "rates-economy"],
    ["Advice costs of CGT changes rise", "advice-tax"],
    ["Victims' advocate says ASIC banning is overdue", "advice-tax"],
  ])("recognises relevant subject language: %s", (title, beat) => {
    const result = assessStory(
      {
        title,
        summary: "New Australian research was released today.",
        sourceUrl: "https://www.accountantsdaily.com.au/news/release",
        channel: "AU",
        articleText: body,
        sourceTiming: timing,
      },
      now
    );
    expect(result).toMatchObject({ eligible: true, beat, channel: "AU" });
  });
  it("keeps industry event roundups and unrelated interviews out", () => {
    for (const title of [
      "SMSF Audit Day 2026 reinforces the role of auditors",
      "Interview with a morning television host",
    ]) {
      expect(
        assessStory(
          {
            title,
            sourceUrl: "https://www.smsfassociation.com/release",
            channel: "AU",
            articleText: body,
            sourceTiming: timing,
          },
          now
        ).eligible
      ).toBe(false);
    }
  });
  it("gives later specialists a reading opportunity without increasing the budget", () => {
    const items = Array.from({ length: 12 }, (_, publisher) =>
      Array.from(
        { length: 10 },
        (_, i) => ({ source: `publisher-${publisher}`, title: `Story ${i}` }) as FetchedItem
      )
    ).flat();
    const selected = readingBudget(items, 100);
    expect(selected).toHaveLength(100);
    expect(new Set(selected.map((item) => item.source)).size).toBe(12);
    expect(new Set(selected).size).toBe(100);
    expect(readingBudget(items, 0)).toEqual([]);
  });
  it.each([
    "Australian home values fall",
    "Australia's most expensive homes decline in value",
    "Sydney residential approvals fall",
    "Australian property market slows",
  ])("carries relevant housing language through to social selection: %s", (title) => {
    expect(australianPropertyTier({ title })).toBe(2);
  });
  it("does not turn overseas research or passing housing mentions into Australian social stories", () => {
    expect(
      australianPropertyTier({
        title: "US home values fall",
        summary: "Australia could draw comparisons.",
        sourceUrl: "https://www.cotality.com/au/insights/articles/us-report",
      })
    ).toBe(0);
    expect(
      australianPropertyTier({
        title: "Australian film festival opens",
        summary: "Home values fell in the area.",
      })
    ).toBe(0);
    expect(
      australianPropertyTier({
        title: "Home values fall",
        sourceUrl: "https://www.cotality.com/au/insights/articles/new-report",
      })
    ).toBe(0);
  });
});
