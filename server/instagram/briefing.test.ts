import { describe, it, expect } from "vitest";
import {
  briefingDetail,
  briefingReady,
  briefingCaption,
  briefingLens,
  briefingAlt,
  buildBriefingSlides,
  briefingClaimLabel,
} from "./briefing";
import type { DailyFeedItem } from "../db/schema";
const story = {
  id: 1,
  title: "Australian dwelling approvals increased",
  summary: "The latest Australian release reports an increase in dwelling approvals.",
  source: "Fixture publisher",
  feedDate: "2026-09-12",
  sayThis: "House prices will double",
  whyItMatters: "Buy now before prices explode",
} as DailyFeedItem;
describe("daily briefing evidence and layout contract", () => {
  it("keeps whole evidence sentences and never copies cached predictions", () => {
    const slides = buildBriefingSlides([story]);
    expect(slides.map((s) => s.kind)).toEqual(["cover", "evidence", "explainer", "takeaway"]);
    expect(slides[1]!.body).toBe(story.summary);
    expect(JSON.stringify(slides.map((s) => [s.title, s.body]))).not.toMatch(
      /double|Buy now|explode/
    );
    expect(briefingCaption([story])).not.toMatch(/double|Buy now|explode/);
    expect(briefingAlt(slides[2]!, 2, 4)).toContain("Approved: Planning or building permission");
  });
  it("rejects boilerplate, headline duplicates and ambiguous supply measures", () => {
    for (const summary of [
      story.title,
      null,
      "Deputy Premier, Minister for State Development and Infrastructure The Honourable Jarrod Bleijie",
      "More than one in five new homes approved across Australia were built in stressed areas.",
    ]) {
      expect(briefingReady({ ...story, summary })).toBe(false);
    }
  });
  it("does not clip a decimal, sentence or long claim", () => {
    const first = "Australian dwelling approvals rose 3.5% in July 2026, according to the report.";
    expect(
      briefingDetail({
        ...story,
        summary: `${first} ${"A long qualification follows. ".repeat(30)}`,
      })
    ).toBe(first);
    expect(
      briefingDetail({
        ...story,
        summary: "An Australian housing claim " + "with detail ".repeat(70),
      })
    ).toBeNull();
    expect(briefingReady({ ...story, title: "Australian housing " + "long ".repeat(40) })).toBe(
      false
    );
  });
  it("carries direction, location, measure and period together without inventing a chart", () => {
    const s = {
      ...story,
      title: "Brisbane rents rose 5.3% in July 2026",
      summary: "Perth rents fell 1.2% over a different period.",
    };
    const slides = buildBriefingSlides([s]);
    expect(slides[0]!.title).toBe(s.title);
    expect(slides[1]!.body).toBe(s.summary);
    expect(slides[2]!.lens.key).toBe("rents");
    expect(slides[2]!.body).not.toMatch(/5.3|1.2|Brisbane|Perth/);
  });
  it("explains an overlap without turning it into a cause or claiming proof", () => {
    const s = { ...story, title: "New homes in areas with high mortgage stress" };
    expect(briefingLens(s).key).toBe("stress");
    expect(briefingLens(s).meaning).toContain("does not establish");
  });
  it("labels modelled claims as estimates and keeps complete story references within the caption limit", () => {
    const s = { ...story, summary: "New modelling estimates fewer Australian dwelling approvals." };
    expect(briefingClaimLabel(s)).toBe("REPORTED ESTIMATE");
    const stories = [s, { ...s, id: 2 }, { ...s, id: 3 }];
    const slides = buildBriefingSlides(stories);
    expect(slides).toHaveLength(6);
    const caption = briefingCaption(stories);
    expect(caption.length).toBeLessThanOrEqual(2200);
    for (const i of [1, 2, 3]) expect(caption).toContain(`/story/${i}?`);
  });
});
