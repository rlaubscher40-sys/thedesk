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

it("gives official workforce releases a reading opportunity without waiving body relevance", () => {
  const item = {
    title: "More apprentices picking up tools as the skills pipeline rebuilds",
    url: "https://www.nsw.gov.au/ministerial-releases/workforce",
    channel: "PROPERTY",
  };
  expect(discoveryScore(item)).toBeGreaterThan(50);
  expect(
    assessStory(
      {
        ...item,
        articleText: "Training in unrelated beauty services expanded across the state. ".repeat(15),
        sourceTiming,
      },
      now
    ).eligible
  ).toBe(false);
});

it.each([
  [
    "Aquaculture leases extended",
    "The fisheries reform supports investment and productivity in oyster farming.",
  ],
  [
    "Mining lease approvals streamlined",
    "The bill reduces duplication in mining approval applications.",
  ],
  [
    "Drought resilience research partnership",
    "Funding supports research into cotton and grain cropping systems.",
  ],
])("does not let a distant economic aside redefine a state release: %s", (title, lead) => {
  const articleText = [
    lead,
    "The release explains the industry programme and its implementation details.",
    "The programme follows consultation with participating businesses.",
    "Further details will be released as implementation proceeds.",
    "A background paragraph discusses employment, productivity and housing supply.",
  ].join("\n\n");
  expect(
    assessStory(
      {
        title,
        url: "https://www.nsw.gov.au/ministerial-releases/example",
        channel: "AU",
        articleText,
        sourceTiming,
      },
      now
    ).eligible
  ).toBe(false);
});
it.each([
  [
    "Applications open for animal welfare and rehoming grants",
    "Animal rescue groups can apply for funding to find cats and dogs safe new homes.",
  ],
  [
    "NSW winners announced at the Resilient Australia Awards",
    "A project protecting social housing is among the winners at this year's awards ceremony.",
  ],
])("rejects a non-housing main subject even with housing vocabulary: %s", (title, lead) => {
  expect(
    assessStory(
      {
        title,
        url: "https://www.nsw.gov.au/ministerial-releases/example",
        channel: "PROPERTY",
        articleText: lead.repeat(15),
        sourceTiming,
      },
      now
    ).eligible
  ).toBe(false);
});
it("retains a housing-focused workforce release", () => {
  const articleText =
    "Apprenticeship commencements grew over three consecutive quarters.\n\nConstruction trades commencements increased by 12 percent over the year.\n\nThe trades are needed to build more homes and deliver essential infrastructure.\n\nThese apprenticeship starts are not a count of qualified workers or completed homes, and qualifications require further training.";
  expect(
    assessStory(
      {
        title: "More NSW apprentices picking up tools",
        url: "https://www.nsw.gov.au/ministerial-releases/example",
        channel: "PROPERTY",
        articleText,
        sourceTiming,
      },
      now
    )
  ).toMatchObject({ eligible: true, beat: "supply" });
});

it("does not borrow housing relevance from a service-directory topic list", () => {
  const articleText =
    "Government information is now easier to understand through a new accessibility programme.\n\nThe programme simplifies language and improves legibility for readers.\n\nResources cover emergency services, housing, transport and fees.\n\nFurther resources are being developed with community organisations.";
  expect(
    assessStory(
      {
        title: "NSW leads on accessible government information",
        url: "https://www.nsw.gov.au/ministerial-releases/example",
        channel: "PROPERTY",
        articleText,
        sourceTiming,
      },
      now
    ).eligible
  ).toBe(false);
});
