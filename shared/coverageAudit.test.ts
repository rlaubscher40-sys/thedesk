import { describe, expect, it } from "vitest";
import { referenceNewsHold } from "./editorial";
import { hasHousingEvidence } from "./marketRelevance";
import {
  editorialToday,
  editorialTimeContext,
  staleFutureDeadline,
  validEditorialAngle,
} from "./editorialTiming";
import { relatedCoverageParent, type RelatedStory } from "./relatedCoverage";
const now = new Date("2026-09-11T11:00:00Z");
const timing = {
  feedReportedAt: null,
  publisherPublishedAt: null,
  publisherPublishedDay: "2026-09-11",
  publisherDateStatus: "available" as const,
  retrievedAt: now.toISOString(),
};
const model = {
  id: 1,
  channel: "PROPERTY",
  title:
    "Joint statement: updated modelling – housing package estimated to cut 10,700 homes and push rents higher",
  sourceTiming: timing,
};
describe("September 11 coverage regressions", () => {
  it("quarantines a general liveblog even when housing appears as a verb", () => {
    const title =
      "Australia news LIVE: Joyce acknowledges contentious debate; UN confirms Iranian site suspected of housing nuclear activities";
    expect(referenceNewsHold({ title, channel: "PROPERTY" })).toBe("general-news-liveblog");
    expect(hasHousingEvidence(title)).toBe(false);
    expect(
      referenceNewsHold({
        title: "Tweed Hospital masterplan consultation opens for 800 homes",
        channel: "PROPERTY",
      })
    ).toBeNull();
    expect(hasHousingEvidence("Former nuclear site to provide 800 homes in NSW")).toBe(true);
  });
  it("rejects sign-offs with no substantive summary", () => {
    expect(
      referenceNewsHold({
        title: "Today's update",
        summary:
          "That's where we'll leave our coverage of national news for Friday, September 11, 2026 .",
      })
    ).toBe("liveblog-signoff");
  });
  it("uses Sydney's date and removes expired future advice, not historical reporting", () => {
    expect(editorialToday(new Date("2026-09-11T15:00:00Z"))).toBe("2026-09-12");
    expect(editorialTimeContext(now)).toContain("2026-09-11");
    expect(
      staleFutureDeadline(
        "Watching: if SMSF lending restrictions visibly dampen new apartment starts by mid-2026, that is your signal the supply hit is real, not theoretical.",
        now
      )
    ).toBe(true);
    expect(validEditorialAngle("Watch for the decision by July 2026.", now)).toBeNull();
    expect(validEditorialAngle("Buying: null\nHolding: Check your lease.", now)).toBeNull();
    for (const text of [
      "ABS reported June quarter 2026 dwelling values on 8 September.",
      "The model forecasts losses in 2026–27 to 2029–30.",
      "Watch for a response by late-2026.",
      "The project was expected to finish by mid-2026.",
    ])
      expect(validEditorialAngle(text, now)).toBe(text);
  });
  it("links same model across local sections and generic followups with publisher evidence", () => {
    expect(
      relatedCoverageParent(
        { title: "Housing reforms to slash 10,700 homes", channel: "AU", sourceTiming: timing },
        [model]
      )?.id
    ).toBe(1);
    expect(
      relatedCoverageParent(
        {
          title: "Housing supply sliding backwards worsening crisis",
          articleText: "Updated modelling shows 10,700 fewer homes after the housing package.",
          channel: "PROPERTY",
          sourceTiming: timing,
        },
        [model]
      )?.id
    ).toBe(1);
  });
  it("does not use missing dates, held records, overseas stories or generated angles as event evidence", () => {
    const target: RelatedStory = {
      title: "Housing supply sliding backwards worsening crisis",
      channel: "PROPERTY",
      sourceTiming: timing,
    };
    expect(relatedCoverageParent(target, [model])).toBeNull();
    expect(relatedCoverageParent({ ...model, id: 2, sourceTiming: null }, [model])).toBeNull();
    expect(relatedCoverageParent({ ...model, id: 2 }, [{ ...model, channel: "HOLD" }])).toBeNull();
    expect(relatedCoverageParent({ ...model, id: 2, channel: "BUSINESS" }, [model])).toBeNull();
    expect(
      relatedCoverageParent({ ...model, id: 2 }, [
        { ...model, sourceTiming: { ...timing, publisherPublishedDay: "2026-09-07" } },
      ])
    ).toBeNull();
  });
});

it("does not thread distinct state housing models sharing a headline count", () => {
 const candidate={...model,title:"Queensland housing modelling predicts 1,500 fewer homes"};
 expect(relatedCoverageParent({...model,id:2,title:"NSW housing modelling predicts 1,500 fewer homes"},[candidate])).toBeNull();
});
