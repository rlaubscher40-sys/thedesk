import { describe, expect, it } from "vitest";
import type { DailyFeedItem } from "../db/schema";
import { buildCoverageCaption, buildDailyCaption, pickDailyTopStories } from "./post";

function fakeStory(o: Partial<DailyFeedItem> = {}): DailyFeedItem {
  return {
    id: 1,
    feedDate: "2026-06-03",
    title: "RBA holds the cash rate at 3.85%",
    source: "AFR",
    sourceUrl: null,
    summary: "The Reserve Bank left the cash rate unchanged at its June meeting.",
    category: "MACRO",
    channel: "AU",
    imageUrl: null,
    partnerTag: null,
    sayThis: "Rates on hold, but the cut talk is getting louder.",
    whyItMatters: "A steady rate keeps borrowing costs flat into spring.",
    counterpoint: null,
    corroborationCount: 1,
    corroboratingSources: null,
    threadParentId: null,
    threadParentTitle: null,
    rubensNote: null,
    priority: 80,
    promotedToEdition: false,
    createdAt: new Date(),
    ...o,
  } as DailyFeedItem;
}

const trio: DailyFeedItem[] = [
  fakeStory({ id: 1, category: "MACRO" }),
  fakeStory({ id: 2, category: "PROPERTY", title: "Sydney auction clearance hits 74%" }),
  fakeStory({ id: 3, category: "MARKETS", title: "ASX 200 rises on a tech-led rally" }),
];

// Guardrail: every carousel (daily AND coverage) targets three story slides.
describe("pickDailyTopStories — slide-count guardrail", () => {
  it("fills to three slides when at least three stories exist", () => {
    expect(pickDailyTopStories(trio, 3)).toHaveLength(3);
  });

  it("prefers category diversity before filling by priority", () => {
    const skewed = [
      fakeStory({ id: 1, category: "MARKETS", priority: 90 }),
      fakeStory({ id: 2, category: "MARKETS", priority: 85 }),
      fakeStory({ id: 3, category: "TECH", priority: 50 }),
    ];
    // One MARKETS + the lone TECH, not both MARKETS, despite priority.
    expect(
      pickDailyTopStories(skewed, 2)
        .map((s) => s.category)
        .sort()
    ).toEqual(["MARKETS", "TECH"]);
  });

  it("never returns more than the limit", () => {
    expect(pickDailyTopStories([...trio, ...trio], 3)).toHaveLength(3);
  });
});

// Guardrail: the morning post stays the partner briefing.
describe("buildDailyCaption — partner briefing", () => {
  it("leads with the AU markets framing and carries the say-this hooks", () => {
    const caption = buildDailyCaption(trio);
    expect(caption).toContain("Australian markets");
    expect(caption).toContain(trio[0]!.sayThis!);
  });
});

// Guardrail: the midday post stays the broader, angle-free coverage briefing.
describe("buildCoverageCaption — wider lens", () => {
  it("uses the wider-lens framing, not the AU markets one", () => {
    const caption = buildCoverageCaption(trio);
    expect(caption).toContain("wider lens");
    expect(caption).not.toContain("Australian markets");
  });

  it("never includes a say-this line (coverage carries no partner angle)", () => {
    // Even though the stories have a say-this, the coverage caption must not
    // surface it — that line is partner-channel only.
    const caption = buildCoverageCaption(trio);
    expect(caption).not.toContain(trio[0]!.sayThis!);
  });

  it("lists every story headline", () => {
    const caption = buildCoverageCaption(trio);
    for (const s of trio) expect(caption).toContain(s.title);
  });
});
