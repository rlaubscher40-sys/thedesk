import { describe, expect, it } from "vitest";
import {
  createEvidenceDuplicateIndex,
  fingerprintStory,
  type EvidenceStory,
} from "./storyEvidenceDuplicate";
import { conflictingEvents } from "./storyEvent";
const body = `Australian housing supply has failed to keep pace with demand in several capital cities. New dwelling approvals fell in the latest monthly release, while rental vacancies remained low. The release compares houses and apartments and separates private construction from public housing projects. The agency said the monthly figures should be read alongside the longer trend because approvals can move sharply when a large apartment project receives permission. Approval is an early step in the construction process and does not establish when a completed home will be available for occupation. For Australian renters and buyers, the immediate issue is the limited number of homes coming onto the market. Higher building costs and financing constraints continue to affect development. The report does not forecast a specific change in interest rates or establish that every suburb will experience the same price movement.`;
const story: EvidenceStory = {
  id: 1,
  title: "Sydney housing approvals fall as builders face delays",
  channel: "PROPERTY",
  articleText: body,
  sourceTiming: {
    publisherDateStatus: "available",
    publisherPublishedDay: "2026-09-10",
    publisherPublishedAt: null,
    feedReportedAt: null,
    retrievedAt: "2026-09-10T00:00:00Z",
  },
};
describe("original-evidence duplicate checks", () => {
  it("matches near-verbatim reporting from a persisted private fingerprint", () => {
    const evidenceFingerprint = fingerprintStory(story)!;
    expect(evidenceFingerprint.hashes.length).toBeGreaterThanOrEqual(80);
    expect(evidenceFingerprint.hashes.every((hash) => /^[a-f0-9]{16}$/.test(hash))).toBe(true);
    const previous = { ...story, articleText: null, evidenceFingerprint };
    const index = createEvidenceDuplicateIndex([previous]);
    expect(
      index.find({
        ...story,
        title: "Sydney housing approvals fall while builders face delays",
        articleText: body.replace("The agency said", "Officials explained"),
      })
    ).toBe(previous);
  });
  it.each([
    { title: "Melbourne housing approvals fall as builders face delays" },
    { title: "Sydney housing approvals rise as builders face delays" },
    { sourceTiming: { ...story.sourceTiming!, publisherPublishedDay: "2026-09-11" } },
    { sourceTiming: null },
    { articleText: "Short shared quote." },
    { articleText: body + " The revised tally is 42 additional projects." },
    { channel: "BUSINESS" },
  ])("retains distinct regions, dates, directions, new facts and missing evidence", (change) => {
    expect(createEvidenceDuplicateIndex([story]).find({ ...story, ...change })).toBeNull();
  });
  it("does not treat a shared quote or topic as duplicate reporting", () => {
    const different =
      body.slice(0, 120) +
      " This separate investigation examines the financing arrangements and interviews builders about delivery risks and costs. ".repeat(
        8
      );
    expect(
      createEvidenceDuplicateIndex([story]).find({ ...story, articleText: different })
    ).toBeNull();
  });
  it("retains changed numeric meaning, even when almost all words repeat", () => {
    const old = {
      ...story,
      articleText: body + " Recorded change was -5% and the project cost $3 million.",
    };
    const index = createEvidenceDuplicateIndex([old]);
    for (const articleText of [
      old.articleText.replace("-5%", "5%"),
      old.articleText.replace("million", "billion"),
      old.articleText.replace("-5%", "-5"),
    ])
      expect(index.find({ ...story, articleText })).toBeNull();
  });
  it("does not trust malformed fingerprints or edited titles", () => {
    const fingerprint = fingerprintStory(story)!;
    expect(
      createEvidenceDuplicateIndex([
        {
          ...story,
          title: "Another headline",
          articleText: null,
          evidenceFingerprint: fingerprint,
        },
      ]).find(story)
    ).toBeNull();
    expect(
      createEvidenceDuplicateIndex([
        { ...story, articleText: null, evidenceFingerprint: { ...fingerprint, hashes: [] } },
      ]).find(story)
    ).toBeNull();
  });
  it("keeps distinct headline figures and reporting periods separate", () => {
    expect(
      conflictingEvents(
        { title: "Sydney housing approvals fall 4 percent" },
        { title: "Sydney housing approvals fall 9 percent" }
      )
    ).toBe(true);
    expect(
      conflictingEvents(
        { title: "Housing approvals released for January" },
        { title: "Housing approvals released for February" }
      )
    ).toBe(true);
  });
});
