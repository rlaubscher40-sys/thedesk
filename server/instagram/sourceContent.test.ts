import { describe, expect, it, vi } from "vitest";
import type { DailyFeedItem, Edition } from "../db/schema";
import {
  currentSocialFeed,
  currentSocialEdition,
  sourceGroundedStory,
  sourceGroundedTopic,
  storyDestination,
  editionDestination,
} from "./sourceContent";
import { pickPropertyTopics } from "./propertyEditorial";

describe("publication evidence date", () => {
  it.each([
    ["2026-09-08T21:30:00Z", "2026-09-09"],
    ["2026-10-04T20:30:00Z", "2026-10-05"],
    ["2026-04-05T21:30:00Z", "2026-04-06"],
  ])("asks explicitly for Sydney's publication date at %s", async (instant, date) => {
    const read = vi.fn().mockResolvedValue([]);
    expect(await currentSocialFeed(read, undefined, new Date(instant))).toEqual({
      date,
      items: [],
    });
    expect(read).toHaveBeenCalledWith(date);
  });
  it("rejects stale or future overrides before reading the archive", async () => {
    const read = vi.fn();
    for (const date of ["2026-09-08", "2026-09-10", "2026-02-30"])
      expect((await currentSocialFeed(read, date, new Date("2026-09-08T21:30:00Z"))).items).toEqual(
        []
      );
    expect(read).not.toHaveBeenCalled();
  });
  it("rejects old rows even when a repository implementation returns them", async () => {
    const read = vi.fn().mockResolvedValue([
      { id: 1, feedDate: "2026-09-08" },
      { id: 2, feedDate: "2026-09-09" },
    ]);
    expect(
      (await currentSocialFeed(read, undefined, new Date("2026-09-08T21:30:00Z"))).items.map(
        (i) => i.id
      )
    ).toEqual([2]);
  });
  it.each([
    ["2026-09-12T23:30:00Z", "2026-09-07"],
    ["2026-09-13T14:01:00Z", "2026-09-14"],
    ["2027-01-02T22:30:00Z", "2026-12-28"],
  ])("selects the current Sydney ISO week at %s", (instant, weekOf) => {
    const correct = { id: 2, weekOf } as Edition;
    const other = [
      { id: 1, weekOf: "2028-01-03" },
      { id: 3, weekOf: "2025-01-06" },
    ] as Edition[];
    expect(currentSocialEdition([...other, correct], new Date(instant))).toBe(correct);
    expect(currentSocialEdition(other, new Date(instant))).toBeNull();
  });
});

describe("source-preserving social copy", () => {
  it("retains entity, sign, measure, unit and period together; strips cached predictions", () => {
    const story = {
      id: 1,
      title: "Brisbane rents rose 5.3% in July 2026",
      summary: "Perth rents fell 1.2% over a different period.",
      sayThis: "Perth rents rose 5.3%",
      whyItMatters: "Prices will double.",
    } as DailyFeedItem;
    const prepared = sourceGroundedStory(story);
    expect(prepared.title).toBe(story.title);
    expect(prepared.summary).toBe(story.summary);
    expect(prepared.sayThis).toBeNull();
    expect(prepared.whyItMatters).not.toMatch(/Perth|Brisbane|5\.3|double/);
    expect(story.sayThis).toBe("Perth rents rose 5.3%");
  });
  it("filters edition topics by source text, not generated angles or category", () => {
    const unrelated = {
      title: "Chipmaker profits rise",
      summary: "Earnings beat estimates",
      category: "PROPERTY",
      whyItMatters: "Housing will boom",
    };
    const housing = {
      title: "Australian housing approvals rise",
      summary: "New dwelling approvals",
      category: "PROPERTY",
      keyTakeaway: "Buy now",
      whatToWatch: ["Prices doubling"],
    };
    expect(pickPropertyTopics([unrelated, housing, housing])).toEqual([housing]);
    expect(sourceGroundedTopic(housing)).toMatchObject({
      title: housing.title,
      summary: housing.summary,
      keyTakeaway: undefined,
      whatToWatch: undefined,
    });
  });
  it("routes readers to stable first-party identities", () => {
    expect(storyDestination({ id: 53 })).toContain("/story/53?utm_source=instagram");
    expect(storyDestination({ id: NaN })).not.toContain("/story/");
    expect(editionDestination({ editionNumber: 9 })).toContain("/editions/9?");
  });
});
