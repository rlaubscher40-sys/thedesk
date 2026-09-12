import { describe, expect, it } from "vitest";
import {
  coverageDaySchema,
  coverageSaveSchema,
  evaluateCoverage,
  type CoverageEntry,
  type CoveragePublication,
} from "./editorialCoverage";
import { EDITORIAL_VERSION, type EditorialReport } from "./editorial";
import { coverageExamples } from "./editorialCoverageExamples";
const day = "2026-09-10",
  now = new Date("2026-09-10T09:00:00Z");
const entry: CoverageEntry = {
  id: "58f2feea-f865-4771-bad6-9f2287ab7001",
  title: "Australian housing release",
  rationale: "Original research relevant to housing supply.",
  urls: ["https://example.com/news/release?id=1"],
  reviewed: true,
};
const publication: CoveragePublication = {
  id: 1,
  title: entry.title,
  sourceUrl: entry.urls[0]!,
  channel: "PROPERTY",
  feedDate: day,
  createdAt: now,
};
const decision = {
  title: entry.title,
  url: entry.urls[0]!,
  source: "Example",
  reason: "selected",
  score: 80,
  selected: true,
  readAttempted: true,
  beat: "housing",
  textChars: 1000,
};
function report(over: Partial<EditorialReport> = {}): EditorialReport {
  return {
    version: EDITORIAL_VERSION,
    runId: "58f2feea-f865-4771-bad6-9f2287ab7002",
    startedAt: "2026-09-10T00:00:00Z",
    finishedAt: "2026-09-10T01:00:00Z",
    status: "published",
    discovered: 10,
    evidencePool: 0,
    inserted: 10,
    read: 10,
    selected: 10,
    sources: [],
    decisions: [decision],
    ...over,
  };
}
const check = (pubs: CoveragePublication[] = [], reports: EditorialReport[] = []) =>
  evaluateCoverage([entry], day, pubs, reports, now);
it("keeps implemented fixes open until publication is observed after implementation", () => {
  const reviewed = {
    ...entry,
    followup: {
      stage: "selection" as const,
      note: "Added the missing housing delivery language",
      changeUrl: "https://github.com/example/repo/pull/1",
      implementedAt: "2026-09-10T08:00:00Z",
    },
  };
  const read = (createdAt: string) =>
    evaluateCoverage([reviewed], day, [{ ...publication, createdAt }], [], now);
  expect(read("2026-09-10T07:00:00Z").rows[0]?.remediation).toBe("awaiting-recheck");
  expect(read("2026-09-10T08:30:00Z").followups.observedAfterFix).toBe(1);
  expect(evaluateCoverage([reviewed], day, [], [report()], now).rows[0]?.remediation).toBe(
    "awaiting-recheck"
  );
  expect(
    coverageSaveSchema.safeParse({
      day,
      version: 0,
      entries: [{ ...reviewed, followup: { ...reviewed.followup, changeUrl: undefined } }],
    }).success
  ).toBe(false);
});
it("does not credit quarantined, future or unrelated social receipts", () => {
  const social = {
    feedItemId: 1,
    state: "confirmed" as const,
    mediaId: "123",
    confirmedAt: "2026-09-10T08:30:00Z",
  };
  expect(evaluateCoverage([entry], day, [publication], [], now, [social]).rows[0]?.social).toEqual([
    social,
  ]);
  expect(
    evaluateCoverage([entry], day, [{ ...publication, channel: "HOLD" }], [], now, [social]).rows[0]
      ?.social
  ).toEqual([]);
  expect(
    evaluateCoverage([entry], day, [publication], [], now, [
      { ...social, confirmedAt: "2026-09-11T08:30:00Z" },
      { ...social, feedItemId: 2 },
    ]).rows[0]?.social
  ).toEqual([]);
});
describe("daily must-cover matching", () => {
  it("counts actual local publication, deduplicates event coverage and strips only tracking", () => {
    const result = check([
      { ...publication, sourceUrl: entry.urls[0] + "&utm_source=feed#top" },
      publication,
    ]);
    expect(result.confirmed).toBe(1);
    expect(result.rows[0]!.status).toBe("published");
    expect(
      check([{ ...publication, sourceUrl: "https://example.com/news/release?id=2" }]).confirmed
    ).toBe(0);
    expect(
      check([{ ...publication, sourceUrl: "https://example.com/news/Release?id=1" }]).confirmed
    ).toBe(0);
  });
  it("credits explicit alternate reporting but never a similar headline alone", () => {
    const alt = "https://another.example/coverage";
    expect(check([{ ...publication, sourceUrl: alt }]).confirmed).toBe(0);
    expect(
      evaluateCoverage(
        [{ ...entry, urls: [...entry.urls, alt] }],
        day,
        [{ ...publication, sourceUrl: alt }],
        [],
        now
      ).confirmed
    ).toBe(1);
  });
  it("does not equate aggregate insertions, selected candidates or already-published claims with publication", () => {
    expect(check([], [report()]).rows[0]!.status).toBe("selected-unconfirmed");
    expect(
      check(
        [],
        [
          report({
            decisions: [
              { ...decision, selected: false, readAttempted: false, reason: "already-published" },
            ],
          }),
        ]
      ).confirmed
    ).toBe(0);
  });
  it("distinguishes holds, unread decisions and missing sampled evidence", () => {
    expect(
      check(
        [],
        [
          report({
            decisions: [{ ...decision, selected: false, reason: "insufficient-article-text" }],
          }),
        ]
      ).rows[0]!.status
    ).toBe("read-held");
    expect(
      check(
        [],
        [
          report({
            decisions: [
              {
                ...decision,
                selected: false,
                readAttempted: false,
                reason: "publisher-reading-limit",
              },
            ],
          }),
        ]
      ).rows[0]!.status
    ).toBe("seen-unread");
    const missing = check([], [report({ decisions: [], decisionCount: 100 })]);
    expect(missing.rows[0]!.status).toBe("unknown");
    expect(missing.sampledRuns).toBe(1);
    expect(check([], [report({ decisions: [] })]).sampledRuns).toBe(1);
  });
  it("keeps coverage in the wrong section and quarantined stories out of the local count", () => {
    expect(check([{ ...publication, channel: "BUSINESS" }]).rows[0]!.status).toBe("other-lane");
    expect(check([{ ...publication, channel: "HOLD" }]).confirmed).toBe(0);
  });
  it("uses a four-day Sydney window and ignores evidence recorded after the review day or now", () => {
    expect(
      check([{ ...publication, feedDate: "2026-09-07", createdAt: "2026-09-06T14:30:00Z" }])
        .confirmed
    ).toBe(1);
    expect(
      check([{ ...publication, feedDate: "2026-09-06", createdAt: "2026-09-06T01:00:00Z" }])
        .confirmed
    ).toBe(0);
    expect(check([{ ...publication, createdAt: "2026-09-11T00:00:00Z" }]).confirmed).toBe(0);
    expect(check([], [report({ finishedAt: "2026-09-10T10:00:00Z" })]).runCount).toBe(0);
    const summer = evaluateCoverage(
      [entry],
      "2026-12-10",
      [{ ...publication, feedDate: "2026-12-07", createdAt: "2026-12-06T13:30:00Z" }],
      [],
      new Date("2026-12-10T09:00:00Z")
    );
    expect(summer.confirmed).toBe(1);
  });
  it("uses the latest matching decision but an actual published story always wins", () => {
    const earlier = report({ decisions: [{ ...decision, selected: false, readAttempted: false }] });
    const later = report({
      finishedAt: "2026-09-10T02:00:00Z",
      decisions: [{ ...decision, selected: false, reason: "off-topic" }],
    });
    expect(check([], [earlier, later]).rows[0]!.status).toBe("read-held");
    expect(check([publication], [later]).rows[0]!.status).toBe("published");
  });
  it("keeps provisional examples outside the reviewed denominator and does not regenerate them on later dates", () => {
    const result = evaluateCoverage([{ ...entry, reviewed: false }], day, [publication], [], now);
    expect(result.reviewed).toBe(0);
    expect(result.confirmed).toBe(0);
    expect(coverageExamples(day).every((e) => !e.reviewed)).toBe(true);
    expect(coverageExamples("2026-09-11")).toEqual([]);
  });
  it("rejects invalid dates, unsafe links and aliases duplicated across events", () => {
    expect(coverageDaySchema.safeParse("2026-02-31").success).toBe(false);
    for (const url of ["javascript:alert(1)", "https://name:password@example.com/news"])
      expect(
        coverageSaveSchema.safeParse({ day, version: 0, entries: [{ ...entry, urls: [url] }] })
          .success
      ).toBe(false);
    expect(
      coverageSaveSchema.safeParse({
        day,
        version: 0,
        entries: [
          entry,
          {
            ...entry,
            id: "58f2feea-f865-4771-bad6-9f2287ab7003",
            urls: [entry.urls[0] + "&utm_source=other"],
          },
        ],
      }).success
    ).toBe(false);
  });
});
