import { describe, expect, it } from "vitest";
import { assessStory, editorialBeat } from "./editorial";
import { editorialTimeContext, validEditorialAngle } from "./editorialTiming";
import { relatedCoverageParent } from "./relatedCoverage";
import { fingerprintStory } from "./storyEvidenceDuplicate";
import { auditedRecordCorrections } from "./auditedRecordCorrections";
import { storySignificance } from "./editorialSignificance";
const now = new Date("2026-09-12T07:00:00Z");
const sourceTiming = {
  publisherDateStatus: "available" as const,
  publisherPublishedDay: "2026-09-11",
  publisherPublishedAt: null,
  retrievedAt: now.toISOString(),
  feedReportedAt: null,
};
const body = Array.from(
  { length: 60 },
  (_, i) =>
    `Survey respondent group ${i} reported changed rental decisions after holding homes for different periods.`
).join(" ");
describe("12 September coverage regressions", () => {
  it.each([
    ["DA approval paves the way for more homes in Bega", "supply", "housing-supply-development"],
    ["Tasmania votes down visitor tax on short-stay accommodation", "policy", "policy-decision"],
    ["Labor ditches new packaging laws", "policy", "policy-decision"],
  ])("recognises consequential events: %s", (title, beat, reason) => {
    expect(editorialBeat(title)).toBe(beat);
    expect(storySignificance(title).reason).toBe(reason);
    expect(
      assessStory(
        {
          title,
          sourceUrl: "https://www.nsw.gov.au/ministerial-releases/report",
          channel: "AU",
          articleText: body,
          sourceTiming,
        },
        now
      ).eligible
    ).toBe(true);
  });
  it.each([
    "Best short-stay holiday deals",
    "Beautiful recyclable packaging designs",
    "Japan rejects a short-stay tax",
  ])("does not waive subject or geography for %s", (title) => {
    expect(
      assessStory(
        {
          title,
          sourceUrl: "https://www.abc.net.au/news/story",
          channel: "AU",
          articleText: body,
          sourceTiming,
        },
        now
      ).eligible
    ).toBe(false);
  });
  it("relates substantially reprinted evidence with different headlines and private fingerprints", () => {
    const parent = {
      id: 1,
      title: "Investor exits hit record high",
      channel: "AU",
      sourceTiming,
      articleText: body,
    };
    const target = {
      id: 2,
      title: "Property owners reconsider tax changes",
      channel: "PROPERTY",
      sourceTiming,
      articleText: "The latest survey describes a changing rental market. " + body,
    };
    expect(relatedCoverageParent(target, [parent])?.id).toBe(1);
    expect(
      relatedCoverageParent(target, [
        { ...parent, articleText: null, evidenceFingerprint: fingerprintStory(parent) },
      ])?.id
    ).toBe(1);
    expect(
      relatedCoverageParent(
        { ...target, sourceTiming: { ...sourceTiming, publisherPublishedDay: "2026-09-12" } },
        [parent]
      )
    ).toBeNull();
    expect(
      relatedCoverageParent(
        { ...target, articleText: body.slice(0, 300) + "Different reporting. ".repeat(100) },
        [parent]
      )
    ).toBeNull();
  });
  it("rejects relative event labels and confused countdowns while retaining absolute milestones", () => {
    expect(
      validEditorialAngle("Funds have two years before data collection begins.", now)
    ).toBeNull();
    expect(validEditorialAngle("The ASX fell today.", now)).toBeNull();
    expect(
      validEditorialAngle("Collection is expected in late 2027; publication follows in 2028.", now)
    ).toBeTruthy();
    expect(editorialTimeContext(now)).toContain(
      "separate dates for consultation, data collection and publication"
    );
  });
  it("corrects only the exact audited wording and keeps a subsequent editor change", () => {
    const row = {
      sourceUrl:
        "https://www.apra.gov.au/news-and-publications/apra-revises-proposals-implement-governments-retirement-reporting-framework",
      feedDate: "2026-09-10",
      counterpoint:
        "Streamlined reporting and a new practice guide still leave funds two years before data collection even begins, plenty of time for the framework to be softened further.",
    };
    expect(auditedRecordCorrections(row)[0]?.after).toContain("late 2027");
    expect(auditedRecordCorrections({ ...row, counterpoint: "An editor corrected this." })).toEqual(
      []
    );
    expect(auditedRecordCorrections({ ...row, feedDate: "2026-09-12" })).toEqual([]);
  });
});
