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
  it("renders a 1080x1350 JPEG for the default navy variant", async () => {
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

  it("survives adversarial inputs without throwing (overflow guards)", async () => {
    // Render-smoke tests can't see overflow, so the defence is input guards:
    // pathologically long titles, labels and values must still produce a card.
    const longStories = stories.map((s, i) =>
      fakeStory({ id: 100 + i, title: "Lorem ipsum dolor sit amet ".repeat(8) })
    );
    const wideMetrics = [
      { label: "An Absurdly Long Metric Label That Should Be Clamped", value: "$1,234,567,890.00" },
      { label: "Cash Rate", value: "3.85%" },
      { label: "ASX 200", value: "7,900" },
      { label: "AUD/USD", value: "0.66" },
      { label: "Overflow", value: "9999" },
    ];
    expectJpeg(await renderDailyCoverCard(longStories, "2026-06-03", "navy", wideMetrics));
    expectJpeg(await renderDailyCoverCard(longStories, "2026-06-03", "light", wideMetrics));
  });
});

// Guardrails so the coverage ("Wider Lens") post stays consistent with the
// daily one: the label overrides plumb through, and the cover renders the same
// shape whether or not a metric strip is present (the no-metrics path reserves
// the strip's space so the title lines up across both posts).
describe("coverage carousel — branding + alignment guardrails", () => {
  it("renders the 'Wider Lens' cover with no metric strip", async () => {
    expectJpeg(
      await renderDailyCoverCard(stories, "2026-06-03", "navy", undefined, {
        title: "The Wider Lens",
        kicker: "Wider Lens",
      })
    );
  });

  it("renders a valid cover both with and without a metric strip", async () => {
    expectJpeg(await renderDailyCoverCard(stories, "2026-06-03", "navy", metrics));
    expectJpeg(
      await renderDailyCoverCard(stories, "2026-06-03", "navy", undefined, {
        title: "The Wider Lens",
        kicker: "Wider Lens",
      })
    );
  });

  it("renders a story card with the 'In Brief' subtext label", async () => {
    expectJpeg(
      await renderDailyStoryCard(stories[0]!, 0, 3, "navy", { subtextLabel: "In Brief" })
    );
  });

  it("renders a long publisher summary as 'In Brief' subtext without chopping off", async () => {
    // Coverage cards put the publisher summary in the subtext slot — denser and
    // longer than a partner why-it-matters. It must trim to a finished sentence
    // and still render a valid card rather than cutting off mid-thought.
    const longSummary = fakeStory({
      title: "Global chipmakers race to secure rare-earth supply as export curbs bite",
      whyItMatters:
        "Beijing's new licensing regime on gallium and germanium has rattled the " +
        "semiconductor supply chain, forcing manufacturers to stockpile and hunt " +
        "for alternative sources across Africa and Australia. Analysts warn the " +
        "scramble could push component prices higher into next year, with knock-on " +
        "effects for everything from electric vehicles to defence electronics.",
    });
    expectJpeg(
      await renderDailyStoryCard(longSummary, 1, 3, "navy", { subtextLabel: "In Brief" })
    );
    expectJpeg(
      await renderDailyStoryCard(longSummary, 1, 3, "light", { subtextLabel: "In Brief" })
    );
  });

  it("renders a story vertical with the coverage header + subtext label", async () => {
    expectJpeg(
      await renderDailyStoryVertical(stories[0]!, "navy", {
        subtextLabel: "In Brief",
        header: "Wider Lens",
      })
    );
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

// A 1×1 transparent PNG, enough to exercise the hero-override branch without
// bundling a fixture image.
const tinyHero =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAen63NgAAAAASUVORK5CYII=";

describe("renderWeeklyCoverCard", () => {
  it("renders a 1080x1350 JPEG contents cover", async () => {
    expectJpeg(await renderWeeklyCoverCard(fakeEdition()));
  });

  it("renders with the edition's own hero override", async () => {
    expectJpeg(await renderWeeklyCoverCard(fakeEdition(), tinyHero));
  });
});

describe("renderWeeklyStoryVertical", () => {
  it("renders a 1080x1920 JPEG edition Story", async () => {
    expectJpeg(await renderWeeklyStoryVertical(fakeEdition()));
  });

  it("renders with the edition's own hero override", async () => {
    expectJpeg(await renderWeeklyStoryVertical(fakeEdition(), tinyHero));
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

  it("survives an overlong title, summary and watch items", async () => {
    const huge = fakeTopic({
      title: "An extraordinarily long topic title that runs well past the usual length ".repeat(2),
      summary: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(8),
      whatToWatch: [
        "A watch item that is itself far too long to sit on a single line and then some more ".repeat(
          2
        ),
        "Another lengthy watch item to exercise the clamp",
        "Third",
        "Fourth that should be dropped past the cap",
      ],
      keyTakeaway:
        "A key takeaway that goes on and on well past what the box should ever hold ".repeat(2),
    });
    expectJpeg(await renderWeeklyTopicCard(huge, 3, 5));
  });
});
