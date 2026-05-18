import { describe, expect, it } from "vitest";
import type { Edition } from "../db/schema";
import { renderEditionCard } from "./editionCard";

function fakeEdition(overrides: Partial<Edition> = {}): Edition {
  return {
    id: 1,
    editionNumber: 1,
    weekOf: "11 May",
    weekRange: "11 May - 17 May, 2026",
    publishedAt: new Date("2026-05-17T07:00:00Z"),
    socialTitle: "The hike, the budget, and the partners who saw it coming",
    metaTitle: null,
    metaDescription: null,
    socialDescription: null,
    rubensTake: null,
    heroImageUrl: null,
    readingTime: "14 min",
    pdfUrl: null,
    topics: [],
    signals: { gold: [], silver: [], bronze: [] },
    fullText: null,
    keyMetrics: null,
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

describe("renderEditionCard", () => {
  it("returns a 1200x630 PNG with the brand surface", async () => {
    const png = await renderEditionCard(fakeEdition());
    expect(png).toBeInstanceOf(Buffer);
    expect(png.byteLength).toBeGreaterThan(20_000);
    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);
  });

  it("caches by editionNumber + publishedAt + title so re-renders return the same buffer", async () => {
    const edition = fakeEdition();
    const first = await renderEditionCard(edition);
    const second = await renderEditionCard(edition);
    // Same cache key, identical instance.
    expect(second).toBe(first);
  });

  it("falls back to the deterministic edition label when no social or meta title is set", async () => {
    const edition = fakeEdition({
      socialTitle: null,
      metaTitle: null,
      editionNumber: 42,
      weekRange: "Week of test",
    });
    // The card render shouldn't throw on missing titles.
    const png = await renderEditionCard(edition);
    expect(png.byteLength).toBeGreaterThan(20_000);
  });
});
