import { beforeEach, describe, expect, it, vi } from "vitest";
import { SOURCES } from "../sources";
import { EVIDENCE_SOURCES } from "../propertySources";
import { createSourceReader } from "./rss";
import { publicFetch } from "./publicFetch";
import { parseVictoriaSource, VICTORIA_SEARCH_BODY, VICTORIA_SEARCH_URL } from "./victoriaSource";
import { assessStory, editorialBeat } from "../../../shared/editorial";
import { australianPropertyTier } from "../../../server/instagram/propertyEditorial";
vi.mock("./publicFetch", () => ({ publicFetch: vi.fn() }));
const source = SOURCES.find((s) => s.kind === "victoria-index")!;
const row = {
  title: ["New homes for regional Victorian families"],
  url: ["/site-4/new-regional-homes"],
  type: ["news"],
  status: [true],
  field_node_site: [4],
  field_news_date: ["2099-01-01"],
  body: ["Index text is not article evidence"],
};
const response = (rows: unknown[]) =>
  JSON.stringify({ hits: { hits: rows.map((_source) => ({ _source })) } });
beforeEach(() => vi.clearAllMocks());

describe("Victorian public media search", () => {
  it("uses the published anonymous POST search, with the normal timeout and size bounds", async () => {
    vi.mocked(publicFetch).mockResolvedValue(new Response(response([row])));
    const report = await createSourceReader()(source);
    expect(report.items).toHaveLength(1);
    expect(publicFetch).toHaveBeenCalledWith(
      VICTORIA_SEARCH_URL,
      expect.objectContaining({
        method: "POST",
        body: VICTORIA_SEARCH_BODY,
        maxBytes: 2 * 1024 * 1024,
        signal: expect.any(AbortSignal),
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      })
    );
    expect(EVIDENCE_SOURCES.some((s) => s.name === source.name)).toBe(false);
  });
  it("never sends the search body to another source", async () => {
    vi.mocked(publicFetch).mockResolvedValue(new Response("[]"));
    await createSourceReader()(SOURCES.find((s) => s.kind === "asic-index")!);
    const init = vi.mocked(publicFetch).mock.calls[0]![1]!;
    expect(init.body).toBeUndefined();
    expect(init.method).toBeUndefined();
  });
  it("accepts only published news on the configured site and canonical public article path", () => {
    const items = parseVictoriaSource(
      response([
        row,
        { ...row, url: ["/site-4/new-regional-homes/"] },
        { ...row, status: [false] },
        { ...row, type: ["landing_page"] },
        { ...row, field_node_site: [5] },
        ...[
          "/site-5/new-regional-homes",
          "https://evil.example/story",
          "//evil.example/story",
          "/site-4/../private",
          "/site-4/%2e%2e",
          "/site-4/media/releases",
        ].map((url) => ({ ...row, url: [url] })),
        null,
      ]),
      source
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      url: "https://www.premier.vic.gov.au/new-regional-homes",
      isoDate: null,
      summary: "",
      discovery: "publisher-index",
    });
    expect(
      parseVictoriaSource(response([row]), { ...source, url: "https://other.example/search" })
    ).toEqual([]);
  });
  it.each([
    "invalid",
    '{"hits":{}}',
    '{"timed_out":true,"hits":{"hits":[]}}',
    '{"_shards":{"failed":1},"hits":{"hits":[]}}',
  ])("surfaces incomplete search responses: %s", async (json) => {
    expect((await createSourceReader(async () => json)(source)).error).toBeTruthy();
  });
  it("bounds candidates", () => {
    expect(
      parseVictoriaSource(
        response(
          Array.from({ length: 30 }, (_, i) => ({ ...row, url: [`/site-4/new-homes-${i}`] }))
        ),
        source
      )
    ).toHaveLength(12);
  });
  it.each([
    "New Homes For Shepparton's Youth and Young At Heart",
    "More Homes Built Faster For Working People",
    "Labor Is Making Way For More Homes",
  ])(
    "recognises explicit housing delivery without borrowing a subject from the body: %s",
    (title) => {
      expect(editorialBeat(title)).toBe("supply");
      expect(australianPropertyTier({ title, summary: "The project is in Victoria." })).toBe(2);
    }
  );
  it("retains original geography, promotional, text and freshness gates", () => {
    const now = new Date("2026-09-10T12:00:00Z");
    const input = {
      title: "New homes for Shepparton families",
      url: "https://www.premier.vic.gov.au/new-regional-homes",
      category: "PROPERTY",
      channel: "PROPERTY",
      articleText:
        "The Victorian Government announced 20 new homes in regional Australia, with construction underway. The project will provide social homes for local residents and includes accessible units. ".repeat(
          12
        ),
      sourceTiming: {
        publisherDateStatus: "available" as const,
        publisherPublishedAt: "2026-09-07T08:25:49Z",
        feedReportedAt: null,
        retrievedAt: now.toISOString(),
      },
    };
    expect(assessStory(input, now).eligible).toBe(true);
    expect(assessStory({ ...input, articleText: "Short introduction" }, now).eligible).toBe(false);
    expect(
      assessStory(
        {
          ...input,
          sourceTiming: { ...input.sourceTiming, publisherPublishedAt: "2026-09-01T08:25:49Z" },
        },
        now
      ).eligible
    ).toBe(false);
    expect(assessStory({ ...input, title: "New homes delivered in US" }, now).reason).toBe(
      "outside-australian-brief"
    );
    expect(assessStory({ ...input, title: "New homes for sale in Shepparton" }, now).eligible).toBe(
      false
    );
    expect(
      australianPropertyTier({
        title: "New homes delivered in US",
        summary: "Victoria could learn from this.",
      })
    ).toBe(0);
    expect(australianPropertyTier({ title: "New homes delivered" })).toBe(0);
    expect(
      australianPropertyTier({
        title: "Film festival returns",
        summary: "New homes in Shepparton are nearby.",
      })
    ).toBe(0);
  });
});
