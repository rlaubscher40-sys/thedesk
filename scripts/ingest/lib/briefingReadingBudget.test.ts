import { expect, it, vi } from "vitest";
import { readingBudget, buildDailyBrief } from "./editorialPipeline";
import { olderIndexPath } from "./indexReadingAge";
import type { FetchedItem } from "./rss";

const now = new Date("2026-09-17T00:00:00Z");
const make = (overrides: Partial<FetchedItem> = {}): FetchedItem => ({
  title: "National Vacancy Rates August 2026",
  source: "SQM Research Releases",
  url: "https://sqmresearch.com.au/uploads/15-09-26-National-Vacancy-Rates-August-2026-2040.pdf",
  channel: "PROPERTY",
  category: "PROPERTY",
  summary: "",
  imageUrl: null,
  discovery: "publisher-index",
  isoDate: null,
  ...overrides,
});
const routine = Array.from({ length: 12 }, (_, i) =>
  make({
    title: `Australian broker ${i} partners with a lender`,
    source: `Broker ${i}`,
    url: `https://www.brokernews.com.au/news/partner-${i}`,
    isoDate: "2026-09-16T00:00:00Z",
  })
);

it("reserves a reading opportunity for a neutral housing release within the same budget", () => {
  const release = make();
  const items = [...routine, release];
  const before = [...items];
  const selected = readingBudget(items, 3, now);
  expect(selected).toHaveLength(3);
  expect(selected[0]).toBe(release);
  expect(new Set(selected).size).toBe(3);
  expect(items).toEqual(before);
});
it.each([0, -1, NaN, Infinity])("does not exceed an invalid reading budget: %s", (limit) => {
  expect(readingBudget([make()], limit, now)).toEqual([]);
});
it.each([
  { url: "https://unknown.example/vacancy" },
  { channel: "GLOBAL" as const },
  { title: "National vacancy rates could rise next month" },
  { title: "Register now for the national vacancy rates webinar" },
  { url: "https://sqmresearch.com.au/uploads/13-08-26-National-Vacancy-Rates-July-2026-2038.pdf" },
])(
  "does not reserve the release slot for unreviewed, foreign, speculative or older copy: %j",
  (overrides) => {
    expect(readingBudget([...routine, make(overrides)], 3, now)).toEqual(routine.slice(0, 3));
  }
);
it("treats the SQM filename date only as an ordering hint, never as publication evidence", async () => {
  expect(olderIndexPath(make(), now)).toBe(false);
  expect(
    olderIndexPath(
      make({
        url: "https://sqmresearch.com.au/uploads/13-08-26-National-Vacancy-Rates-July-2026-2038.pdf",
      }),
      now
    )
  ).toBe(true);
  const readArticle = vi.fn(async () => ({
    text: "Australian rental vacancy rates were reported in the monthly housing release. ".repeat(
      12
    ),
    imageUrl: null,
    publicationDate: { publisherPublishedAt: null, publisherDateStatus: "missing" as const },
  }));
  const result = await buildDailyBrief({
    sources: [],
    extraCandidates: [make()],
    now,
    resolve: async (url) => url,
    readArticle,
  });
  expect(readArticle).toHaveBeenCalledOnce();
  expect(result.items).toEqual([]);
  expect(result.report.decisions[0]?.reason).toBe("old-or-invalid-feed-date");
});

it("accepts a neutral SQM vacancy release only with independently supplied document timing and rental evidence", async () => {
  const readArticle = async () => ({
    text: "Australian rental vacancy rates fell to 1.2% in the new monthly release. ".repeat(12),
    imageUrl: null,
    publicationDate: {
      publisherPublishedAt: null,
      publisherPublishedDay: "2026-09-15",
      publisherDateStatus: "available" as const,
    },
  });
  const result = await buildDailyBrief({
    sources: [],
    extraCandidates: [make()],
    now,
    resolve: async (url) => url,
    readArticle,
  });
  expect(result.items).toHaveLength(1);
  expect(result.report.decisions[0]?.reason).toBe("selected");
});
