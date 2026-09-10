import { describe, expect, it } from "vitest";
import { isClearlyOverseas, routeStory, storyChannel } from "./storyGeography";
import { SOURCES } from "../scripts/ingest/sources";

const story = { channel: "AU", category: "PROPERTY", source: "ABC News Business" };

describe("Australian story geography", () => {
  it.each([
    "Home prices fall in most major US cities as housing market cools: See where",
    "U.S. mortgage rates drop again",
    "Trump pushes Fed for lower rates, but consumers may be better off with a hike, experts say",
    "S&P 500 ends down as oil tops $100 per barrel",
    "3 S&P 500 Stocks with Open Questions",
    "Receipts, memes and supermarket shelves: how Iranians are documenting the economic cost of war online",
    "London rents hit a new record",
    "California home prices fall",
  ])("moves foreign reporting out of Australia: %s", (title) => {
    expect(storyChannel({ ...story, title, summary: "What Australian investors can learn from this." })).toBe("BUSINESS");
    expect(isClearlyOverseas({ ...story, title })).toBe(true);
  });

  it.each([
    ["ASX narrows losses as oil jumps towards $US100", ""],
    ["US tariffs hit Australian exporters", ""],
    ["RBA holds rates steady", ""],
    ["Home prices rise", "Sydney and Melbourne lead the increase."],
    ["Man charged over court data breach asked AI for legal advice", "A Sydney man faces trial."],
    ["The fight for your superannuation is heating up", ""],
    ["What rate cuts mean for us", "Australian borrowers weigh refinancing."],
    ["Borrowers fed up with rate hikes", "Sydney borrowers weigh refinancing."],
  ])("keeps Australian reporting: %s", (title, summary) => {
    expect(storyChannel({ ...story, title, summary })).toBe("AU");
    expect(isClearlyOverseas({ title })).toBe(false);
  });

  it("accepts domestic official and section URLs, but not a publisher's locale", () => {
    expect(storyChannel({ ...story, title: "Cash rate decision", sourceUrl: "https://www.rba.gov.au/media-releases/2026/mr.html" })).toBe("AU");
    expect(storyChannel({ ...story, title: "Cabinet agrees housing deal", sourceUrl: "https://www.theguardian.com/australia-news/2026/sep/10/housing" })).toBe("AU");
    expect(storyChannel({ ...story, title: "Home prices fall", sourceUrl: "https://www.abc.net.au/news/overseas-story" })).toBe("BUSINESS");
    expect(storyChannel({ ...story, title: "Home prices fall", sourceUrl: "https://news.google.com/rss?gl=AU" })).toBe("BUSINESS");
  });

  it("applies to Property and untagged legacy ingest, preserving topic and identity", () => {
    const item = { ...story, id: 3840008, channel: "PROPERTY", title: "US housing cools" };
    expect(routeStory(item)).toEqual({ ...item, channel: "BUSINESS" });
    expect(storyChannel({ title: item.title, category: "PROPERTY" })).toBe("BUSINESS");
    expect(storyChannel({ title: "Iran war escalates", category: "GEOPOLITICS" })).toBe("GLOBAL");
  });

  it("preserves existing coverage lanes and unknown historical stories", () => {
    expect(storyChannel({ ...story, channel: "GLOBAL", title: "Sydney hosts summit" })).toBe("GLOBAL");
    expect(isClearlyOverseas({ title: "Cabinet agrees housing deal" })).toBe(false);
    expect(isClearlyOverseas({ title: "Rates rise", source: "Global · Central banks" })).toBe(true);
  });

  it("assigns all three international finance feeds to Business", () => {
    const global = SOURCES.filter((source) => source.name.startsWith("Global ·"));
    expect(global).toHaveLength(3);
    expect(global.every((source) => source.channel === "BUSINESS")).toBe(true);
  });
});
