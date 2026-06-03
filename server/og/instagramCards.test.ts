import { describe, expect, it } from "vitest";
import type { DailyFeedItem } from "../db/schema";
import { renderDailyCoverCard } from "./instagramCards";

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
  fakeStory({ id: 2, category: "PROPERTY", title: "Sydney auction clearance hits 74%, the strongest spring result in years" }),
  fakeStory({ id: 3, category: "MARKETS", title: "Build-to-rent pipeline doubles as super funds chase stable long-term yield" }),
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
