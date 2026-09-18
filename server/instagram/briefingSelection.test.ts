import { beforeEach, expect, it, vi } from "vitest";
import type { DailyFeedItem } from "../db/schema";
import { testSourceTiming } from "./testSourceTiming";
const m = vi.hoisted(() => ({ unused: vi.fn() }));
vi.mock("./socialPublication", () => ({ unpublishedSocialStories: m.unused }));
import {
  assessBriefingStory,
  briefingSelectionAudit,
  pickBriefingStories,
  unpublishedBriefingSelection,
} from "./briefingSelection";
const story = (id: number, overrides: Partial<DailyFeedItem> = {}) =>
  ({
    id,
    title: `Sydney rents update ${id}`,
    summary: "ABS data show rents paid rose 3.5% in July.",
    source: "ABS",
    sourceUrl: `https://www.abs.gov.au/rents/${id}`,
    priority: 50,
    channel: "PROPERTY",
    feedDate: "2026-09-08",
    sourceTiming: testSourceTiming(),
    ...overrides,
  }) as DailyFeedItem;
beforeEach(() => vi.resetAllMocks());
it("keeps the September 17 suburb-price headline when the source summary establishes housing", () => {
  const candidate = story(3930103, {
    title: "'Hasn't stopped': Sydney suburbs defying price slump",
    summary:
      "Sydney home values have fallen below their previous peak, according to the latest Home Price Report.",
    source: "realestate.com.au News",
    sourceUrl:
      "https://www.realestate.com.au/news/hasnt-stopped-sydney-suburbs-defying-price-slump/",
  });
  expect(assessBriefingStory(candidate)).toMatchObject({ tier: 2, hold: null });
  expect(pickBriefingStories([candidate])).toEqual([candidate]);
  expect(candidate.title).toBe("'Hasn't stopped': Sydney suburbs defying price slump");
});
it.each([
  { summary: "Sydney petrol prices have fallen." },
  { summary: null, whyItMatters: "Sydney home values are falling." },
  { title: "London suburbs defying price slump" },
  { title: "Sydney suburbs welcome a new festival" },
  { title: "Sydney suburbs see petrol prices fall" },
  { sourceTiming: null },
  { sourceUrl: null },
  { summary: "Sydney home values fell. Sponsored content: book a free consultation." },
])("does not broaden the suburb-price exception past evidence safeguards: %j", (overrides) => {
  const candidate = story(1, {
    title: "Sydney suburbs defying price slump",
    summary: "Sydney home values fell in the latest monthly report.",
    ...overrides,
  });
  expect(pickBriefingStories([candidate])).toEqual([]);
});
it("audits distinct eligibility failures without checking or changing publication locks", () => {
  const rows = briefingSelectionAudit([
    story(1, { channel: "GLOBAL" }),
    story(2, { sourceTiming: null }),
    story(3, { source: "" }),
    story(4, { title: "London rents rise" }),
    story(5, { title: "Rents rise", summary: "Rents paid rose in July." }),
    story(6, { title: "Sydney chipmaker profits rise" }),
    story(7),
  ]);
  expect(rows.map((row) => row.hold)).toEqual([
    "outside-australian-property-channels",
    "missing-source-timing",
    "missing-publisher",
    "foreign-housing-story",
    "missing-australian-geography",
    "no-property-or-financing-subject",
    null,
  ]);
  expect(m.unused).not.toHaveBeenCalled();
  expect(JSON.stringify(rows)).not.toContain("https://");
});
it("requires rental evidence and Australian geography for a neutral vacancy report", () => {
  const candidate = story(8, {
    title: "National Vacancy Rates August 2026",
    summary: "Australian rental vacancy rates fell in the latest monthly report.",
  });
  expect(pickBriefingStories([candidate])).toEqual([candidate]);
  expect(
    pickBriefingStories([{ ...candidate, summary: "Australian job vacancy rates fell." }])
  ).toEqual([]);
  expect(pickBriefingStories([{ ...candidate, summary: "Rental vacancy rates fell." }])).toEqual(
    []
  );
});
it("lets usable reported figures lead ahead of a dramatic higher-priority forecast or opinion", () => {
  const data = story(1);
  const forecast = story(2, {
    title: "Sydney housing to collapse",
    summary: "New modelling forecasts 10,700 fewer Sydney homes.",
    priority: 99,
  });
  const opinion = story(3, {
    title: "Sydney housing: maybe that's OK",
    summary: "We believe Sydney housing needs a different approach.",
    priority: 98,
  });
  expect(pickBriefingStories([forecast, opinion, data]).map((s) => s.id)).toEqual([1, 2, 3]);
  expect(assessBriefingStory(forecast).kind).toBe("Forecast or modelling");
  expect(data.title).toBe("Sydney rents update 1");
});
it.each([
  { sourceUrl: null },
  { summary: null },
  { sourceTiming: null },
  { summary: "It's why we're delivering homes to help families in Sydney." },
  { title: "Sydney housing investment opportunity: book a free consultation" },
  {
    title: "Sydney new homes",
    summary: "New homes approved across Australia were built in stressed areas.",
  },
  {
    title: "Brisbane auction sales fall 40 per cent",
    summary: "Brisbane clearance rates dropped 40 per cent from the same time last year.",
  },
])("holds unusable copy before rendering: %j", (overrides) => {
  expect(pickBriefingStories([story(1, overrides)])).toEqual([]);
  expect(assessBriefingStory(story(1, overrides)).hold).toBeTruthy();
});
it("uses canonical source identity, preserving content-selecting query parameters", () => {
  const a = story(1, { sourceUrl: "https://www.abs.gov.au/rents?id=1&utm_source=feed" });
  const b = story(2, { sourceUrl: "https://abs.gov.au/rents?utm_source=other&id=1#top" });
  const c = story(3, { sourceUrl: "https://abs.gov.au/rents?id=2" });
  expect(pickBriefingStories([a, b, c]).map((s) => s.id)).toEqual([1, 3]);
});
it("cannot upgrade irrelevant news using generated copy or the publisher's name", () => {
  expect(
    pickBriefingStories([
      story(1, {
        title: "Chipmaker earnings rise",
        whyItMatters: "Sydney housing data surged 10%",
      }),
    ])
  ).toEqual([]);
});
it("finds fresh stories beyond the old six-item pool without changing permanent locks", async () => {
  const input = Array.from({ length: 9 }, (_, i) => story(i + 1));
  m.unused.mockImplementation(async (rows: DailyFeedItem[]) => rows.filter((s) => s.id > 6));
  expect((await unpublishedBriefingSelection(input)).map((s) => s.id)).toEqual([7, 8, 9]);
  expect(m.unused.mock.calls[0][0]).toHaveLength(9);
});
it("preserves editorial priority across equally classified financing and housing news", () => {
  const housing = story(1, {
    title: "Sydney housing outlook",
    summary: "Sydney housing supply remains constrained.",
  });
  const financing = story(2, {
    title: "RBA interest rate outlook",
    summary: "The RBA discusses interest rates in Australia.",
    priority: 90,
  });
  expect(pickBriefingStories([housing, financing]).map((s) => s.id)).toEqual([2, 1]);
});
it("diversifies related coverage but preserves changed regional reporting", () => {
  const lead = story(1, { title: "Sydney rents rise", priority: 80 });
  const related = story(2, { title: "Sydney rental costs rise", threadParentId: 1 });
  const update = story(3, {
    title: "Melbourne rents rise",
    summary: "ABS data show Melbourne rents paid rose 3.5% in July.",
    threadParentId: 1,
  });
  expect(pickBriefingStories([lead, related, update]).map((s) => s.id)).toEqual([1, 3]);
});
it("checks publication before related-coverage diversity so a used lead cannot hide fresh reporting", async () => {
  const lead = story(1, { title: "Sydney rents rise", priority: 80 });
  const related = story(2, { title: "Sydney rental costs rise", threadParentId: 1 });
  m.unused.mockImplementation(async (rows: DailyFeedItem[]) => rows.filter((s) => s.id !== 1));
  expect((await unpublishedBriefingSelection([lead, related])).map((s) => s.id)).toEqual([2]);
});
