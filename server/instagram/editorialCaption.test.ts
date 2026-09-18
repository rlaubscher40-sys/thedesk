import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { captionBeat, captionClaim, composeEditorialCaption } from "./editorialCaption";
import { assertCaptionStyle } from "./captionStyle";
import {
  buildDailyCaption,
  buildCoverageCaption,
  buildWeeklyCaption,
  buildStatCaption,
  buildMonthlyCaption,
  buildReelCaption,
} from "./post";
import { buildDocumentaryCaption } from "./documentaryCaption";
import { DOCUMENTARY_EPISODES } from "./documentaryEpisodes";
import { DOCUMENTARY_READING, DOCUMENTARY_SOURCES } from "../../shared/documentaryReels";
import { documentaryLaunchReady } from "./verifiedDocumentaryReel";
import { documentaryReviewHash, sealDocumentary } from "../video/documentaryStory";
import { buildLaunchContent } from "./launchContent";
import { createImageContainer, createCarouselContainer, createReelContainer } from "./api";
import type { DailyFeedItem, Edition } from "../db/schema";
import { testSourceTiming } from "./testSourceTiming";

const story = (id = 1, title = "Sydney dwelling approvals rose 3.5% in July 2026") =>
  ({
    id,
    title,
    summary:
      "The source reports a 3.5% rise in Sydney dwelling approvals in July 2026, not completed homes.",
    source: "Fixture publisher",
    sourceUrl: `https://example.com/${id}`,
    feedDate: "2026-09-12",
    sourceTiming: testSourceTiming("2026-09-12"),
    channel: "AU",
    category: "PROPERTY",
    priority: 90 - id,
    sayThis: "Buy now before prices double",
    whyItMatters: "Perth will boom next year",
  }) as DailyFeedItem;
const stat = {
  label: "RBA cash rate",
  value: "3.85%",
  line: "Prices will double next year.",
  subtext: "LOWEST OF 18 RECORDED READINGS",
  source: "RBA",
  asOf: new Date("2026-09-12T00:00:00Z"),
};
const input = {
  hook: "Approvals are not completed homes.",
  paragraphs: ["The source counts permissions to build."],
  action: "Compare starts and completions in the same area.",
  references: ["Source: ABS."],
  beat: "supply" as const,
};

describe("automatic editorial caption contract", () => {
  it("keeps the reader's story ahead of the source footer with relevant tags", () => {
    const text = composeEditorialCaption(input);
    expect(text.indexOf(input.action)).toBeLessThan(text.indexOf("Source:"));
    expect(text.match(/#[\w]+/g)).toEqual(["#AusProperty", "#HousingSupply", "#TheDesk"]);
    expect(text).not.toMatch(/Follow|Like|Comment yes|Save this story/);
  });
  it("does not pad, clip or silently discard facts when they do not fit", () => {
    expect(() => composeEditorialCaption({ ...input, paragraphs: ["x".repeat(2300)] })).toThrow(
      "no factual truncation"
    );
    expect(() => composeEditorialCaption({ ...input, hook: "x".repeat(201) })).toThrow(
      "shorter complete"
    );
    expect(() => composeEditorialCaption({ ...input, references: [] })).toThrow(
      "source references"
    );
    expect(() => composeEditorialCaption({ ...input, action: " " })).toThrow();
  });
  it("preserves signed figures, acronyms, case-sensitive URLs and period ranges", () => {
    const text = composeEditorialCaption({
      ...input,
      paragraphs: ["ABS: -1.2%, NSW, A$350m, 1928–1994."],
      references: ["Source: https://example.com/ABS/CaseSensitive?period=2026-07#table"],
    });
    expect(text).toContain("ABS: -1.2%, NSW, A$350m, 1928–1994.");
    expect(text).toContain("https://example.com/ABS/CaseSensitive?period=2026-07#table");
    expect(captionClaim("RBA CROSSED BELOW 4% IN NSW")).toBe("RBA crossed below 4% in NSW.");
    expect(captionClaim("-0.25PP BETWEEN READINGS")).toBe("-0.25pp between readings.");
  });
  it.each([
    ["New home loans", "loans"],
    ["Sydney auction clearance", "auction"],
    ["Perth rents", "rents"],
    ["Interstate migration", "population"],
    ["New homes approved", "supply"],
    ["Sydney property prices", "property"],
  ])("matches the topic %s without random filler", (title, beat) => {
    expect(captionBeat(title)).toBe(beat);
  });
});

describe("regular post caption paths", () => {
  it("gives briefings one headline, evidence, labelled context and complete dated references", () => {
    const first = story();
    const text = buildDailyCaption([first, story(2, "Brisbane rents rose 2% in July 2026")]);
    expect(text.startsWith(first.title)).toBe(true);
    expect(text.split(first.title)).toHaveLength(2);
    expect(text).toContain(first.summary);
    expect(text).toContain("Context:");
    expect(text).toContain("Publisher reports publication:");
    expect(text).toContain("/story/1?");
    expect(text).toContain("/story/2?");
    expect(text).not.toMatch(/double|will boom|Save this for your next/);
  });
  it("keeps wider-lens headlines whole and adds references without property tags", () => {
    const lead = {
      ...story(),
      category: "SCIENCE",
      title:
        "A science headline with an important qualification " + "and relevant context ".repeat(4),
    };
    const text = buildCoverageCaption([lead]);
    expect(text).toContain(lead.title.trim());
    expect(text).toContain("#ScienceNews");
    expect(text).not.toContain("#AusProperty");
    expect(text).toContain("/story/1?");
    expect(() => buildCoverageCaption([{ ...lead, title: "Long ".repeat(100) }])).toThrow(
      "no factual truncation"
    );
  });
  it("keeps weekly source dates and evidence while removing the repeated headline", () => {
    const s = story();
    const edition = {
      editionNumber: 12,
      weekOf: "2026-09-07",
      weekRange: "7–13 September 2026",
      topics: [
        {
          title: s.title,
          summary: s.summary,
          category: "PROPERTY",
          socialSource: {
            publisher: s.source,
            feedDate: s.feedDate,
            sourceTiming: s.sourceTiming,
            url: s.sourceUrl,
          },
        },
      ],
    } as Edition;
    const text = buildWeeklyCaption(edition);
    expect(text.startsWith(s.title)).toBe(true);
    expect(text).toContain(s.summary);
    expect(text).toContain("https://example.com/1");
    expect(text).toContain("/editions/12?");
    expect(text).toContain("7–13 September 2026");
    expect(() =>
      buildWeeklyCaption({
        ...edition,
        topics: edition.topics.map((t) => ({ ...t, socialSource: undefined })),
      })
    ).toThrow("source-attributed");
  });
  it("uses computed stat claims rather than model interpretations and preserves source dates", () => {
    for (const build of [buildStatCaption, buildReelCaption]) {
      const text = build(stat);
      expect(text).toContain("RBA cash rate: 3.85%.");
      expect(text).toContain("Lowest of 18 recorded readings.");
      expect(text).toContain("Source: RBA");
      expect(text).toContain("Recorded reading: 2026-09-12");
      expect(text).not.toMatch(/double|brisbane-vs-perth|rba cash/);
      expect(text).toContain("#HomeLoans");
      expect(build({ ...stat, value: "4.10%" })).toContain("4.10%");
      expect(() => build({ ...stat, source: null })).toThrow("source");
    }
  });
  it("pairs each monthly figure with its source rather than claiming a nonexistent monthly bio page", () => {
    const text = buildMonthlyCaption(
      { label: "August 2026", reading: "The cash rate moved in August." },
      [
        {
          label: "RBA cash rate",
          move: "-0.25pp",
          claim: "FIRST MOVE IN 6 MONTHS",
          source: "RBA; The Desk calculation",
        },
        {
          label: "Sydney approvals",
          move: "+3.5%",
          claim: "2.1x ITS USUAL MONTH",
          source: "ABS; The Desk calculation",
        },
      ]
    );
    expect(text).toContain("1. Source: RBA; The Desk calculation");
    expect(text).toContain("2. Source: ABS; The Desk calculation");
    expect(text).toContain("-0.25pp");
    expect(text).toContain("not a measure of investment returns");
    expect(text).not.toContain("full month, every number");
    expect(text).toContain("/markets?");
  });
  it("applies the shared standard to introductory posts too", () => {
    for (const id of ["start", "how"] as const)
      expect(() => assertCaptionStyle(buildLaunchContent(id).caption)).not.toThrow();
  });
});

describe("documentary captions, not rewritten films", () => {
  it("has a distinct written hook and payoff for every registered film, with every source and licence", () => {
    const captions = DOCUMENTARY_EPISODES.map(buildDocumentaryCaption);
    expect(new Set(captions.map((caption) => caption.split("\n")[0])).size).toBe(4);
    for (const [i, episode] of DOCUMENTARY_EPISODES.entries()) {
      const text = captions[i]!;
      const reading = DOCUMENTARY_READING.find((r) => r.id === episode.id)!;
      expect(text.length).toBeLessThanOrEqual(2200);
      expect(text.split("\n")[0]!.length).toBeLessThanOrEqual(110);
      expect(text.split("\n")[0]).not.toBe(episode.scenes[0]!.phrases[0]);
      expect(text).toContain("The Desk's reading:");
      expect(text).toContain(reading.limitation);
      expect(text).toContain(`thedesk.au/social#${episode.id}`);
      expect(text).toContain("AI narration.");
      if (episode.treatment === "series-led-v1") expect(text).toContain("CC BY-SA 4.0");
      for (const id of reading.sources) {
        const source = DOCUMENTARY_SOURCES[id];
        expect(text).toContain(
          "captionCitation" in source ? source.captionCitation : source.publisher
        );
      }
    }
  });
  it("does not approve films, change Harry's input hash or admit an unregistered subject", () => {
    expect(documentaryLaunchReady()).toBe(true);
    const harry = DOCUMENTARY_EPISODES.find((e) => e.id === "triguboff-apartments")!;
    expect(documentaryReviewHash(sealDocumentary(harry))).toBe(
      "ee8cf73ded8469d8925262eb5917cd4fdc77cc853aca14bf0c9e6c51152d9aef"
    );
    expect(() => buildDocumentaryCaption({ ...harry, id: "new-film" })).toThrow("source notes");
  });
  it("keeps scheduler caption source detail separate from the existing card layout", () => {
    const route = readFileSync(new URL("../scheduledRoutes.ts", import.meta.url), "utf8");
    expect(route).toContain("captionSource: metrics.find");
    expect(route).toContain("recorded-history calculation");
  });
});

afterEach(() => vi.unstubAllGlobals());
describe("manual and automatic API backstop", () => {
  it.each([
    "",
    " ",
    "x".repeat(2201),
    "#one #two #three #four #five #six",
    "Comment yes for the answer.",
  ])("holds invalid caption before Meta", async (caption) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const shared = { igUserId: "fixture", accessToken: "fixture", caption };
    await expect(
      createImageContainer({ ...shared, imageUrl: "https://example.com/image.jpg" })
    ).rejects.toThrow();
    await expect(createCarouselContainer({ ...shared, childrenIds: ["1", "2"] })).rejects.toThrow();
    await expect(
      createReelContainer({ ...shared, videoUrl: "https://example.com/video.mp4" })
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
