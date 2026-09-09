import { describe, expect, it } from "vitest";
import type { DailyFeedItem, DailyMetric } from "../db/schema";
import {
  explainNoPropertyStat,
  pickPropertyStat,
  pickPropertyStories,
  propertyStoryTier,
  rehearsePropertyStat,
} from "./propertyEditorial";
import { pickStatOfTheDay, type HistoryPoint } from "./statPick";

const NOW = new Date("2026-09-08T00:00:00Z");
const story = (overrides: Partial<DailyFeedItem> = {}) =>
  ({
    id: 1,
    title: "Brisbane rents rise",
    summary: null,
    channel: "PROPERTY",
    category: "PROPERTY",
    source: "ABS",
    priority: 50,
    sourceUrl: null,
    ...overrides,
  }) as DailyFeedItem;
const metric = (overrides: Partial<DailyMetric> = {}) =>
  ({
    metricKey: "auction_clearance",
    label: "Auction clearance",
    value: "58",
    unit: "%",
    previousValue: "59",
    source: "CoreLogic",
    sourceUrl: "https://example.com/source",
    asOf: new Date("2026-09-07T00:00:00Z"),
    ...overrides,
  }) as DailyMetric;
const history = (values = [64, 63, 62, 61, 60, 59]): HistoryPoint[] =>
  values.map((value, i) => ({
    value,
    recordedAt: new Date(NOW.getTime() - (values.length - i) * 86400000),
  }));

describe("property story selection", () => {
  it("keeps search spam and recycled market updates out of automatic social selection", () => {
    for (const title of [
      "Perth Housing Market Update | April 2026 Emergency Alert Today (7Y9mHxXuGJ)",
      "Perth housing market update April 2026",
    ])
      expect(propertyStoryTier(story({ title, feedDate: "2026-09-09" }))).toBe(0);
  });
  it("rejects Canadian Perth through an aggregator's URL using its explicit publisher", () => {
    expect(
      propertyStoryTier(
        story({
          title: "Major housing project approved on historic Perth golf course",
          source: "CBC",
          sourceUrl: "https://news.google.com/rss/articles/fixture",
        })
      )
    ).toBe(0);
    expect(
      propertyStoryTier(
        story({ title: "Perth housing approvals rise", source: "The West Australian" })
      )
    ).toBe(2);
  });
  it("does not mistake the word act for Australian geography", () => {
    expect(propertyStoryTier(story({ title: "Housing act changes rental rules" }))).toBe(0);
    expect(propertyStoryTier(story({ title: "ACT housing approvals rise" }))).toBe(2);
  });
  it("leads with direct property ahead of higher-priority financing and excludes unrelated markets", () => {
    const input = [
      story({ id: 3, title: "ASX surges", channel: "AU", priority: 99 }),
      story({ id: 2, title: "RBA leaves cash rate unchanged", channel: "AU", priority: 90 }),
      story(),
    ];
    expect(pickPropertyStories(input).map((s) => s.id)).toEqual([1, 2]);
    expect(input.map((s) => s.id)).toEqual([3, 2, 1]);
  });
  it("does not let categories or generated implications manufacture relevance", () => {
    expect(
      propertyStoryTier(
        story({ title: "Chipmaker earnings rise", whyItMatters: "Housing may benefit" })
      )
    ).toBe(0);
    expect(pickPropertyStories([story({ title: "Chipmaker earnings rise" })])).toEqual([]);
  });
  it("uses source summary, requires attribution, and keeps wider coverage separate", () => {
    expect(
      propertyStoryTier(
        story({ title: "New figures released", summary: "Australian dwelling approvals fell." })
      )
    ).toBe(2);
    expect(propertyStoryTier(story({ source: " " }))).toBe(0);
    expect(propertyStoryTier(story({ channel: "GLOBAL" }))).toBe(0);
  });
  it("deduplicates IDs, titles and source URLs without altering evidence", () => {
    const original = story({ sourceUrl: "https://example.com/a" });
    const selected = pickPropertyStories([
      original,
      original,
      story({ id: 2 }),
      story({ id: 3, title: "Rent evidence released", sourceUrl: original.sourceUrl }),
    ]);
    expect(selected).toEqual([original]);
    expect(selected[0]).toBe(original);
  });
  it("keeps multiple property stories instead of forcing category diversity", () => {
    expect(
      pickPropertyStories([story(), story({ id: 2, title: "Sydney house prices fall" })])
    ).toHaveLength(2);
    expect(pickPropertyStories([story()], 0)).toEqual([]);
    expect(pickPropertyStories([story()], -1)).toEqual([]);
  });
  it("rejects foreign housing even if a feed lane says AU and an implication mentions Australia", () => {
    for (const title of [
      "The US cities where home prices are falling the fastest",
      "Cotality: Local Economies, Not National Trends Drive US Home Prices",
      "Ontario Land Tribunal approves Perth housing redevelopment",
      "UK housing prices rise",
    ]) {
      expect(
        propertyStoryTier(
          story({
            title,
            channel: "AU",
            summary: "Australian buyers may be interested in these rents.",
          })
        )
      ).toBe(0);
    }
    expect(
      propertyStoryTier(
        story({
          title: "Major housing project approved on historic Perth golf course",
          sourceUrl: "https://www.cbc.ca/news/story",
        })
      )
    ).toBe(0);
  });
  it("requires a clear property headline and local scope, not a passing summary mention", () => {
    expect(
      propertyStoryTier(
        story({
          title: "Chalmers says super puts Australia ahead on pension spending",
          summary: "The report debates access for renters and homebuyers.",
        })
      )
    ).toBe(0);
    expect(propertyStoryTier(story({ title: "Dwelling approvals rise", summary: null }))).toBe(0);
    expect(propertyStoryTier(story({ title: "Australian home loans rise" }))).toBe(2);
    expect(propertyStoryTier(story({ title: "Sydney rents give us a new comparison" }))).toBe(2);
  });
});

describe("property statistic selection", () => {
  it("excludes an unusual FX or equity reading even with a property label", () => {
    const unrelated = metric({ metricKey: "asx200", label: "Property" });
    expect(pickStatOfTheDay([unrelated], { asx200: history() }, NOW)).not.toBeNull();
    expect(pickPropertyStat([unrelated], { asx200: history() }, NOW)).toBeNull();
    expect(rehearsePropertyStat([unrelated], { asx200: history() }, NOW)).toBeNull();
  });
  it("prefers direct housing, preserving every field and the evidence-scoped claim", () => {
    const direct = metric();
    const rates = metric({ metricKey: "cash_rate" });
    const histories = { auction_clearance: history(), cash_rate: history() };
    const pick = pickPropertyStat([rates, direct], histories, NOW);
    expect(pick).toEqual(pickStatOfTheDay([direct], histories, NOW));
    expect(pick?.subtext).toContain("RECORDED");
    expect(pick?.sourceUrl).toBe(direct.sourceUrl);
  });
  it("uses cash rate only when no direct metric earns a post", () => {
    expect(
      pickPropertyStat(
        [metric(), metric({ metricKey: "cash_rate" })],
        { cash_rate: history() },
        NOW
      )?.metricKey
    ).toBe("cash_rate");
  });
  it("does not lower evidence or freshness thresholds", () => {
    expect(pickPropertyStat([metric()], {}, NOW)).toBeNull();
    expect(
      pickPropertyStat(
        [metric({ asOf: new Date("2025-01-01") })],
        { auction_clearance: history() },
        NOW
      )
    ).toBeNull();
    expect(explainNoPropertyStat([], {}, NOW)).toContain("No eligible property");
  });
  it("quiet-day rehearsal is preview-only and never substitutes an unrelated move", () => {
    const flat = metric({ value: "60", previousValue: "60" });
    const histories = { auction_clearance: history([60, 60, 60, 60, 60, 60]), asx200: history() };
    const metrics = [flat, metric({ metricKey: "asx200" })];
    expect(pickPropertyStat(metrics, histories, NOW)).toBeNull();
    expect(rehearsePropertyStat(metrics, histories, NOW)).toMatchObject({
      metricKey: "auction_clearance",
      score: 0,
    });
    expect(explainNoPropertyStat(metrics, histories, NOW)).toContain(
      "No property or cash-rate metric cleared"
    );
  });
  it("preview uses exactly the live pick when there is an eligible story", () => {
    const metrics = [metric()];
    const histories = { auction_clearance: history() };
    expect(rehearsePropertyStat(metrics, histories, NOW)).toEqual(
      pickPropertyStat(metrics, histories, NOW)
    );
  });
});
