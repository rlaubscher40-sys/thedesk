import { describe, expect, it } from "vitest";
import { SOURCES } from "../sources";
import { EVIDENCE_SOURCES } from "../propertySources";
import { createSourceReader } from "./rss";
import { parseNswSource } from "./nswSource";
import { parseIndexSource } from "./indexSource";
import { extractArticleText } from "./article";
import { extractPublicationDate } from "./publicationDate";
import { editorialBeat, referenceNewsHold } from "../../../shared/editorial";

const nsw = SOURCES.find((s) => s.name === "NSW Housing Releases")!;
const release = {
  status: [true],
  subtype: ["ministerialmediarelease"],
  title: ["New social homes for regional families"],
  url: ["/ministerial-releases/new-homes"],
  display_date: [9999999999],
};
const search = (rows: unknown[]) =>
  JSON.stringify({ hits: { hits: rows.map((_source) => ({ _source })) } });
describe("regional discovery and evidence", () => {
  it("reads the native NSW response without promoting search timestamps or reference pages", async () => {
    const json = search([
      release,
      release,
      { ...release, status: [false] },
      { ...release, subtype: ["resource"] },
      { ...release, url: ["https://other.example/ministerial-releases/new-homes"] },
      { ...release, url: ["/housing/reference"] },
      null,
    ]);
    const report = await createSourceReader(async () => json)(nsw);
    expect(report.error).toBeNull();
    expect(report.items).toHaveLength(1);
    expect(report.items[0]).toMatchObject({
      isoDate: null,
      summary: "",
      discovery: "publisher-index",
      url: "https://www.nsw.gov.au/ministerial-releases/new-homes",
    });
    expect(EVIDENCE_SOURCES.every((s) => !s.kind || s.kind === "rss")).toBe(true);
    expect(parseNswSource('{"timed_out":true,"hits":{"hits":[]}}', nsw)).toEqual([]);
    expect((await createSourceReader(async () => "invalid JSON")(nsw)).error).toBeTruthy();
  });
  it("uses Queensland's native housing search and restricts links to individual releases", () => {
    const source = SOURCES.find((s) => s.name === "Queensland Housing Releases")!;
    expect(new URL(source.url).searchParams.get("Text")).toBe("housing");
    expect(
      parseIndexSource(
        '<a href="/statements/123">New homes unlocked for regional families</a><a href="/?pageIndex=2">More housing search results</a>',
        source
      )
    ).toHaveLength(1);
  });
  it.each([
    ["2026-09-10", "2026-09-09T21:26:35Z"],
    ["2026-12-10", "2026-12-09T13:30:00Z"],
  ])(
    "reconciles the NSW local publication day %s with UTC, including daylight saving",
    (day, timestamp) => {
      const html = `<meta property="article:published_time" content="${day}"><script type="application/ld+json">{"@type":"NewsArticle","datePublished":"${timestamp}"}</script>`;
      expect(
        extractPublicationDate(html, "https://www.nsw.gov.au/ministerial-releases/test")
      ).toEqual({
        publisherPublishedAt: null,
        publisherPublishedDay: day,
        publisherDateStatus: "available",
      });
      expect(
        extractPublicationDate(html, "https://other.example/release").publisherDateStatus
      ).toBe("conflicting");
      expect(
        extractPublicationDate(html.replace(day, "2026-09-07"), nsw.url).publisherDateStatus
      ).toBe("conflicting");
    }
  );
  it("uses AHURI's visible original date, scoped to that publisher", () => {
    const html = '<p><span class="page-date">27 Aug 2026</span></p>';
    expect(extractPublicationDate(html, "https://www.ahuri.edu.au/news/release")).toMatchObject({
      publisherPublishedDay: "2026-08-27",
      publisherDateStatus: "available",
      publisherPublishedAt: null,
    });
    expect(extractPublicationDate(html, "https://other.example/release").publisherDateStatus).toBe(
      "missing"
    );
    expect(
      extractPublicationDate(
        html.replace("27 Aug", "31 Sep"),
        "https://www.ahuri.edu.au/news/release"
      ).publisherDateStatus
    ).toBe("invalid");
  });
  it("retains nested Housing Australia body sections and excludes surrounding navigation", () => {
    const intro = "An Australian housing project has reached its next stage of development.";
    const detail =
      "The release explains the delivery timetable, funding and the number of affordable homes in the project.";
    const text = extractArticleText(
      `<nav><p>Navigation information that must never become reporting evidence for this project.</p></nav><article><article aria-label="Introduction"><p>${intro}</p></article><article aria-label="body-copy"><p>${detail}</p></article></article><p>Unrelated surrounding page content that must never become article evidence.</p>`,
      6000
    );
    expect(text).toBe(`${intro}\n\n${detail}`);
  });
  it.each([
    "Housing Australia welcomes appointment of new Chair",
    "David Example appointed Chair of AHURI board",
  ])("holds staff announcements: %s", (title) => {
    expect(referenceNewsHold({ title })).toBe("reference-or-staff-profile");
  });
  it("recognises property listings research without treating a single property advertisement as research", () => {
    expect(editorialBeat("Total Property Listings - August 2026")).toBe("housing");
    expect(referenceNewsHold({ title: "Dream home for sale in Sydney" })).toBe(
      "individual-property-promotion"
    );
  });
});
