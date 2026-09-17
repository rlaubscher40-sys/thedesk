import { expect, it } from "vitest";
import { SOURCES } from "../sources";
import { parseIndexSource } from "./indexSource";
import { parseNswSource } from "./nswSource";
import { extractArticleText } from "./article";
import { assessStory, discoveryScore, publisherWeight } from "../../../shared/editorial";
import { reportingExcerpt } from "../../../shared/reportingExcerpt";
const now = new Date("2026-09-17T10:00:00Z");
const sourceTiming = {
  feedReportedAt: null,
  publisherPublishedAt: null,
  publisherPublishedDay: "2026-09-17",
  publisherDateStatus: "available" as const,
  retrievedAt: now.toISOString(),
};
it("discovers CBA macro reporting and changed ASX slugs on the actual newsroom path", () => {
  const source = SOURCES.find((s) => s.name === "CBA Australian Market Close")!;
  const links = [
    "stand-ready-more-interest-rate-rises-imf",
    "aussie-shares-lift-fed-rate-call-calms-bond-market",
  ];
  const html =
    links
      .map(
        (slug) =>
          `<a href="/articles/newsroom/2026/09/${slug}.html">Reserve Bank and Australian economy reporting</a>`
      )
      .join("") + '<a href="/personal/home-loans.html">Home loan product marketing</a>';
  expect(parseIndexSource(html, source).map((i) => i.url)).toEqual(
    links.map((slug) => `https://www.commbank.com.au/articles/newsroom/2026/09/${slug}.html`)
  );
});
it("reads NSW release content in discovery and allows short substantive titles without trusting index evidence", () => {
  const source = SOURCES.find((s) => s.name === "NSW Housing Releases")!;
  expect(new URL(source.url).searchParams.get("q")).toContain("content:planning");
  const [item] = parseNswSource(
    JSON.stringify({
      hits: {
        hits: [
          {
            _source: {
              status: [true],
              subtype: ["ministerialmediarelease"],
              title: ["Town Hall Square"],
              url: ["/ministerial-releases/town-hall-square"],
              summary: ["Planning approval for housing development is delayed."],
              display_date: [9999999999],
            },
          },
        ],
      },
    }),
    source
  );
  expect(item).toMatchObject({ summary: "", isoDate: null, title: "Town Hall Square" });
  expect(discoveryScore(item!)).toBeGreaterThan(50);
  expect(
    assessStory(
      {
        ...item!,
        articleText: "An unrelated local community celebration. ".repeat(25),
        sourceTiming,
      },
      now
    ).eligible
  ).toBe(false);
});
it("uses verified official body evidence for generic land and planning releases", () => {
  const body =
    "Legislation introduced today would repeal worker accommodation obligations. The town is opening land to residential investors through a registration of interest. ".repeat(
      4
    );
  expect(
    assessStory(
      {
        title: "Pathway forward delivered for central Queensland town",
        url: "https://statements.qld.gov.au/statements/106053",
        channel: "PROPERTY",
        articleText: body,
        sourceTiming,
      },
      now
    )
  ).toMatchObject({ eligible: true, beat: "policy" });
  expect(publisherWeight({ title: "Reference", url: "https://www.nsw.gov.au/reference" })).toBe(5);
  expect(
    assessStory(
      {
        title: "Community celebration",
        url: "https://statements.qld.gov.au/statements/106999",
        channel: "PROPERTY",
        articleText: "The community celebrated a sporting achievement at a local event. ".repeat(
          12
        ),
        sourceTiming,
      },
      now
    ).eligible
  ).toBe(false);
});
it("attributes first-person NSW statements only to an explicitly declared ministerial role", () => {
  const statement =
    "I have issued a direction preventing determination of development applications for Town Hall Square until independent advice is received.";
  const html = `<dl><dt>Released by:</dt><dd>Minister for Planning and Public Spaces</dd></dl><article><p>${statement}</p></article>`;
  const url = "https://www.nsw.gov.au/ministerial-releases/town-hall-square";
  const text = extractArticleText(html, 6000, url)!;
  expect(reportingExcerpt("Town Hall Square", text)).toContain(
    "The NSW Minister for Planning and Public Spaces stated:"
  );
  expect(extractArticleText(html, 6000, "https://other.test/story")).toBe(statement);
  expect(extractArticleText(html.replace("Released by:", "Related to:"), 6000, url)).toBe(
    statement
  );
});
