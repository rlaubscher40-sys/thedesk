import { describe, expect, it } from "vitest";
import { SOURCES } from "../sources";
import { EVIDENCE_SOURCES } from "../propertySources";
import { createSourceReader } from "./rss";
import { parseAsicSource } from "./asicSource";
import { extractPublicationDate } from "./publicationDate";
import { assessStory } from "../../../shared/editorial";

const source = SOURCES.find((s) => s.name === "ASIC Media Releases")!;
const url =
  "https://www.asic.gov.au/about-asic/news-centre/find-a-media-release/2026-releases/26-999mr-super-disclosures";
// Original synthetic fixtures model the publicly observed publisher schema.
const release = {
  name: "ASIC issues infringement notices over superannuation disclosures",
  url,
  metaType: "media release",
  publishedDate: "2099-01-01T12:00:00Z",
  updateDate: "2099-01-02T12:00:00Z",
  metaDescription: "Discovery descriptions must not supply article evidence.",
};
const display = (value: string) => `<meta name="displayDate" content="${value}">`;

describe("ASIC newsroom discovery", () => {
  it("reads current releases and deduplicates canonical links without adopting index evidence", async () => {
    const report = await createSourceReader(async () =>
      JSON.stringify([
        release,
        { ...release, url: url + "/?campaign=1#top" },
        { ...release, metaType: "report" },
        { ...release, url: "/newsroom/media-releases/" },
        { ...release, url: url.replace("www.asic.gov.au", "www.asic.gov.au.example.com") },
        { ...release, url: url.replace("https://", "https://user:secret@") },
        { ...release, url: url.replace("https:", "http:") },
        { ...release, name: "" },
        null,
      ])
    )(source);
    expect(report.error).toBeNull();
    expect(report.items).toHaveLength(1);
    expect(report.items[0]).toMatchObject({
      url,
      isoDate: null,
      summary: "",
      imageUrl: null,
      discovery: "publisher-index",
    });
    expect(EVIDENCE_SOURCES.some((s) => s.name === source.name)).toBe(false);
  });
  it("bounds candidates and surfaces malformed or changed response schemas", async () => {
    expect(
      parseAsicSource(
        JSON.stringify(Array.from({ length: 50 }, (_, i) => ({ ...release, url: url + i }))),
        source
      )
    ).toHaveLength(12);
    expect(
      parseAsicSource(JSON.stringify([release]), { ...source, url: "https://other.example/feed" })
    ).toEqual([]);
    for (const json of ["bad JSON", '{"error":"temporarily unavailable"}', "null"])
      expect((await createSourceReader(async () => json)(source)).error).toBeTruthy();
  });
  it("uses only the release's display date, preserving day precision", () => {
    expect(
      extractPublicationDate(
        display("8 September 2026") +
          '<meta name="dcterms.date.created" content="2020-01-01"><meta name="dcterms.date.modified" content="2099-01-01">',
        url
      )
    ).toEqual({
      publisherPublishedAt: null,
      publisherPublishedDay: "2026-09-08",
      publisherDateStatus: "available",
    });
    expect(
      extractPublicationDate('<meta name="dcterms.date.created" content="2026-09-10">', url)
        .publisherDateStatus
    ).toBe("missing");
  });
  it.each([
    "https://unreviewed.example/release",
    "https://www.asic.gov.au/newsroom/media-releases/",
    "https://www.asic.gov.au.example.com/about-asic/news-centre/find-a-media-release/2026-releases/test",
  ])("does not broaden date recognition to %s", (otherUrl) => {
    expect(extractPublicationDate(display("10 September 2026"), otherUrl).publisherDateStatus).toBe(
      "missing"
    );
  });
  it("holds invalid and conflicting original dates", () => {
    expect(extractPublicationDate(display("31 September 2026"), url).publisherDateStatus).toBe(
      "invalid"
    );
    expect(
      extractPublicationDate(display("10 September 2026") + display("9 September 2026"), url)
        .publisherDateStatus
    ).toBe("conflicting");
    expect(
      extractPublicationDate(
        display("10 September 2026") +
          '<meta property="article:published_time" content="2026-09-09">',
        url
      ).publisherDateStatus
    ).toBe("conflicting");
  });
  it("still requires readable original evidence and freshness for selection", () => {
    const [item] = parseAsicSource(JSON.stringify([release]), source);
    const now = new Date("2026-09-10T12:00:00Z");
    const articleText =
      "The Australian regulator reviewed superannuation investment disclosures and identified misleading statements to members. Its findings describe the notices and the responses from the trustees. ".repeat(
        5
      );
    const input = {
      ...item!,
      articleText,
      sourceTiming: {
        ...extractPublicationDate(display("8 September 2026"), url),
        feedReportedAt: null,
        retrievedAt: now.toISOString(),
      },
    };
    expect(assessStory(input, now).eligible).toBe(true);
    expect(assessStory({ ...input, articleText: null }, now).eligible).toBe(false);
    expect(
      assessStory(
        {
          ...input,
          sourceTiming: {
            ...input.sourceTiming,
            ...extractPublicationDate(display("1 September 2026"), url),
          },
        },
        now
      ).eligible
    ).toBe(false);
  });
});
