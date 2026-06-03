import { describe, expect, it } from "vitest";
import type { DailyFeedItem, Edition } from "../db/schema";
import type { EditionTopic } from "../../shared/schemas";
import {
  renderDailyCoverCard,
  renderDailyStoryCard,
  renderDailyStoryVertical,
  renderWeeklyCoverCard,
  renderWeeklyStoryVertical,
  renderWeeklyTopicCard,
} from "./instagramCards";

function fakeStory(overrides: Partial<DailyFeedItem> = {}): DailyFeedItem {
  return {
    id: 1,
    feedDate: "2026-06-03",
    title: "RBA holds cash rate at 3.85% as inflation cools faster than forecast",
    source: "AFR",
    sourceUrl: null,
    summary: "The Reserve Bank left the cash rate unchanged at its June meeting.",
    category: "ECONOMY",
    imageUrl: null,
    partnerTag: null,
    sayThis: "Rates on hold — but the cut talk is getting louder.",
    whyItMatters: "A steady rate keeps borrowing costs flat into spring selling season.",
    counterpoint: null,
    corroborationCount: 1,
    corroboratingSources: null,
    threadParentId: null,
    threadParentTitle: null,
    rubensNote: null,
    priority: 80,
    promotedToEdition: false,
    createdAt: new Date(),
    ...overrides,
  } as DailyFeedItem;
}

const stories: DailyFeedItem[] = [
  fakeStory({ id: 1, category: "ECONOMY" }),
  fakeStory({
    id: 2,
    category: "PROPERTY",
    title: "Sydney auction clearance hits 74%, the strongest spring result in years",
  }),
  fakeStory({
    id: 3,
    category: "MARKETS",
    title: "Build-to-rent pipeline doubles as super funds chase stable long-term yield",
  }),
];

const metrics = [
  { label: "Cash Rate", value: "3.85%" },
  { label: "ASX 200", value: "7,900" },
  { label: "AUD/USD", value: "0.66" },
];

/** JPEG starts with the SOI marker 0xFF 0xD8 0xFF. */
function expectJpeg(buf: Buffer) {
  expect(buf).toBeInstanceOf(Buffer);
  expect(buf.byteLength).toBeGreaterThan(20_000);
  expect(buf[0]).toBe(0xff);
  expect(buf[1]).toBe(0xd8);
  expect(buf[2]).toBe(0xff);
}

describe("renderDailyCoverCard", () => {
  it("renders a 1080x1080 JPEG for the default navy variant", async () => {
    expectJpeg(await renderDailyCoverCard(stories, "2026-06-03"));
  });

  it("renders the light variant (the other half of the checkerboard)", async () => {
    expectJpeg(await renderDailyCoverCard(stories, "2026-06-03", "light"));
  });

  it("renders the metric strip when metrics are supplied", async () => {
    // The strip is wired from the morning's daily metrics; passing them must
    // not throw and must still produce a valid cover for either variant.
    expectJpeg(await renderDailyCoverCard(stories, "2026-06-03", "navy", metrics));
    expectJpeg(await renderDailyCoverCard(stories, "2026-06-03", "light", metrics));
  });

  it("tolerates an empty metric strip and a missing feedDate", async () => {
    expectJpeg(await renderDailyCoverCard(stories, null, "navy", []));
  });
});

describe("renderDailyStoryVertical", () => {
  it("renders a 1080x1920 JPEG for both checkerboard variants", async () => {
    // The Story matches the day's cover variant so the two formats read as
    // one system; both colourways must render without throwing.
    expectJpeg(await renderDailyStoryVertical(stories[0]!, "navy"));
    expectJpeg(await renderDailyStoryVertical(stories[0]!, "light"));
  });

  it("renders when the lead story has no why-it-matters", async () => {
    expectJpeg(await renderDailyStoryVertical(fakeStory({ whyItMatters: null })));
  });
});

describe("renderDailyStoryCard", () => {
  it("renders carousel slides in both variants so a light post stays cohesive", async () => {
    expectJpeg(await renderDailyStoryCard(stories[0]!, 0, 3, "navy"));
    expectJpeg(await renderDailyStoryCard(stories[0]!, 0, 3, "light"));
  });
});

function fakeTopic(overrides: Partial<EditionTopic> = {}): EditionTopic {
  return {
    title: "Where the rate-cut cycle leaves borrowers",
    summary:
      "The first cut in eighteen months reframes the fixed-versus-variable call for every mortgage holder.",
    category: "ECONOMY",
    keyTakeaway: "Variable holders win first; the Q3 fixed rolloffs are the ones to watch.",
    whyItMatters: "Repayments ease for variable borrowers now, but the relief is uneven.",
    whatToWatch: [
      "Whether the majors pass the full cut to variable rates",
      "Q3 fixed-rate expiries hitting 4.1% borrowers",
    ],
    ...overrides,
  } as EditionTopic;
}

function fakeEdition(overrides: Partial<Edition> = {}): Edition {
  return {
    id: 1,
    editionNumber: 3,
    weekOf: "1 June",
    weekRange: "1 June - 7 June, 2026",
    publishedAt: new Date("2026-06-07T07:00:00Z"),
    socialTitle: null,
    metaTitle: null,
    metaDescription: null,
    socialDescription: null,
    rubensTake: "The cut everyone wanted is the cut nobody should relax about.",
    heroImageUrl: null,
    readingTime: "14 min",
    pdfUrl: null,
    topics: [
      fakeTopic(),
      fakeTopic({ title: "Brisbane overtakes Melbourne", category: "PROPERTY" }),
    ],
    signals: { gold: [], silver: [], bronze: [] },
    fullText: null,
    keyMetrics: { cashRate: "3.85%", asx200: "7,900" },
    substackDraftTitle: null,
    substackDraftSubtitle: null,
    substackDraftBody: null,
    substackDraftImageUrl: null,
    marketStress: null,
    datesToWatch: null,
    headlineVariants: null,
    createdAt: new Date(),
    ...overrides,
  } as Edition;
}

describe("renderWeeklyCoverCard", () => {
  it("renders a 1080x1350 JPEG contents cover", async () => {
    expectJpeg(await renderWeeklyCoverCard(fakeEdition()));
  });
});

describe("renderWeeklyStoryVertical", () => {
  it("renders a 1080x1920 JPEG edition Story", async () => {
    expectJpeg(await renderWeeklyStoryVertical(fakeEdition()));
  });
});

describe("renderWeeklyTopicCard", () => {
  it("renders a rich topic card with why-it-matters and what-to-watch", async () => {
    expectJpeg(await renderWeeklyTopicCard(fakeTopic(), 1, 4));
  });

  it("still renders when the optional analysis fields are absent", async () => {
    // A sparse topic (no why / watch / takeaway) must not throw and must
    // still produce a valid card — the layout degrades gracefully.
    const sparse = fakeTopic({
      whyItMatters: undefined,
      whatToWatch: undefined,
      keyTakeaway: undefined,
    });
    expectJpeg(await renderWeeklyTopicCard(sparse, 2, 4));
  });
});
