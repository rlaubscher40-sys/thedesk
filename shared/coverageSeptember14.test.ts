import { expect, it } from "vitest";
import { hasHousingEvidence } from "./marketRelevance";
import { editorialCategory } from "./editorialCategory";
import { assessStory, editorialBeat, localEditorialChannel, publisherWeight } from "./editorial";
import { storyChannel } from "./storyGeography";
import { checkClaimEvidence } from "./claimEvidence";
import { auditedRecordCorrections } from "./auditedRecordCorrections";
import { relatedCoverageParent } from "./relatedCoverage";
import { cleanHeadline } from "./headline";
import { storySignificance } from "./editorialSignificance";

it("ranks a record affordability release as data, not routine industry news", () => {
  expect(storySignificance("WA housing and rental affordability at record lows").reason).toBe("market-data-development");
  expect(storySignificance("WA housing affordability could reach record lows").reason).toBe("analysis-or-proposal");
});

it("does not treat every story about students or migrants as economic policy", () => {
  expect(editorialBeat("International students celebrate at a cultural festival")).toBeNull();
  expect(editorialBeat("Migrant workers share their favourite recipes")).toBeNull();
  expect(editorialBeat("New rules change work rights for international students")).toBe("policy");
});

const timing = {
  publisherDateStatus: "available" as const,
  publisherPublishedAt: null,
  publisherPublishedDay: "2026-09-14",
  feedReportedAt: null,
  retrievedAt: "2026-09-14T11:00:00Z",
};
it("does not use employment vacancies as housing evidence in any shared consumer", () => {
  const title = "Labor questions scale of vacancy freezes";
  const summary =
    "Labor asks which Tasmanian departments have been told to leave vacant jobs unfilled.";
  expect(hasHousingEvidence(`${title} ${summary}`)).toBe(false);
  expect(editorialBeat(`${title} ${summary}`)).toBe("rates-economy");
  expect(localEditorialChannel({ title, summary, channel: "PROPERTY" })).toBe("AU");
  expect(editorialCategory(title, summary, "PROPERTY")).toBe("MACRO");
  for (const s of [
    "Perth rental vacancy falls",
    "Housing vacancies rise",
    "Sydney property vacancies fall",
  ])
    expect(hasHousingEvidence(s)).toBe(true);
  expect(hasHousingEvidence("Hospital job vacancies increase")).toBe(false);
});
it("strips the entire ABC masthead before deciding geography", () => {
  const title =
    "Markets live updates: Wall Street rises despite hot inflation - ABC News & Headlines - Australian Broadcasting Corporation";
  expect(cleanHeadline(title)).toBe(
    "Markets live updates: Wall Street rises despite hot inflation"
  );
  expect(
    storyChannel({
      title,
      source: "ABC News & Headlines - Australian Broadcasting Corporation",
      channel: "AU",
      category: "MACRO",
    })
  ).toBe("BUSINESS");
  expect(
    storyChannel({
      title: "Australian shares rise as Wall Street rebounds",
      channel: "AU",
      category: "MARKETS",
    })
  ).toBe("AU");
});
it("recognises domestic lender reporting without treating offshore lender operations as domestic", () => {
  const summary =
    "The Commonwealth Bank cut mortgage rates while the Reserve Bank reviews inflation.";
  expect(
    storyChannel({
      title: "Mortgage competition heats up",
      summary,
      channel: "PROPERTY",
      category: "PROPERTY",
    })
  ).toBe("PROPERTY");
  expect(
    storyChannel({
      title: "Commonwealth Bank expands US mortgage operations",
      summary,
      channel: "PROPERTY",
      category: "PROPERTY",
    })
  ).toBe("BUSINESS");
  expect(
    storyChannel({
      title: "Bank of England cuts mortgage rates",
      summary: "UK lenders compete.",
      channel: "PROPERTY",
      category: "PROPERTY",
    })
  ).toBe("BUSINESS");
});
it.each([
  "One Nation unveils breathing space plan for net-negative migration",
  "One Nation migration plan to cut students and migrant worker families",
  "Preparing for the removal of card surcharging",
])("recognises consequential policy reporting: %s", (title) => {
  expect(editorialBeat(title)).toBe("policy");
  const result = assessStory(
    {
      title,
      channel: "AU",
      sourceUrl: "https://www.abc.net.au/news/example",
      sourceTiming: timing,
      articleText:
        "Australian policymakers are considering changes affecting households and business. The proposal and its implementation dates remain distinct from the publication date. ".repeat(
          5
        ),
    },
    new Date(timing.retrievedAt)
  );
  expect(result.eligible).toBe(true);
});
const evidence = {
  title: "Crisis and transitional housing grants",
  articleText:
    "The grant program supports the delivery of 968 dwellings that are expected to assist more than 35,000 people over the next 20 years. The loan conversion supports around 500 additional homes.",
};
it("does not turn a beneficiary period into a delivery timetable, or homes into beds", () => {
  expect(checkClaimEvidence("968 dwellings spread nationally over 20 years.", evidence)).toContain(
    "period-scope"
  );
  expect(checkClaimEvidence("The program adds 500 beds.", evidence)).toContain("figure-unit");
  expect(
    checkClaimEvidence(
      "The 968 dwellings are expected to assist more than 35,000 people over 20 years.",
      evidence
    )
  ).toEqual([]);
  expect(checkClaimEvidence("The program supports around 500 additional homes.", evidence)).toEqual(
    []
  );
  expect(
    checkClaimEvidence("The program will build 968 dwellings over 20 years.", {
      ...evidence,
      articleText: evidence.articleText + " The program will build 968 dwellings over 20 years.",
    })
  ).not.toContain("period-scope");
});
it("retains party proposals and non-binding motions as proposals", () => {
  const source = {
    title: "Migration proposal",
    articleText: "A party proposes cutting 750,000 temporary visas over three years.",
  };
  expect(checkClaimEvidence("Australia will cut 750,000 temporary visas.", source)).toContain(
    "proposal-as-fact"
  );
  expect(
    checkClaimEvidence("The party proposes cutting 750,000 temporary visas.", source)
  ).not.toContain("proposal-as-fact");
});
it("repairs only the audited housing field and never overwrites a later edit", () => {
  const row = {
    feedDate: "2026-09-14",
    sourceUrl:
      "https://www.housingaustralia.gov.au/media/housing-australia-welcomes-australian-governments-additional-300-million-commitment-deliver",
    whyItMatters:
      "With $614.6 million approved across 115 projects as at 31 July 2026, the program's scale is real, but 968 dwellings spread nationally over 20 years leaves the structural shortfall in crisis accommodation largely intact.",
  };
  expect(auditedRecordCorrections(row)[0]?.after).toContain("service horizon");
  expect(auditedRecordCorrections({ ...row, whyItMatters: "Ruben's edited explanation" })).toEqual(
    []
  );
  expect(auditedRecordCorrections({ ...row, feedDate: "2026-09-13" })).toEqual([]);
});
it("groups the same named grant program, amount and day without hiding unrelated funding", () => {
  const parent = {
    id: 1,
    title: "Housing Australia welcomes $300 million in grant funding",
    summary: "HAFF Crisis and Transitional housing grant program",
    channel: "PROPERTY",
    sourceTiming: timing,
  };
  const child = {
    id: 2,
    title: "Fresh funding for crisis housing",
    summary:
      "The Housing Australia Future Fund crisis and transitional program receives $300 million in grants.",
    channel: "PROPERTY",
    sourceTiming: timing,
  };
  expect(relatedCoverageParent(child, [parent])?.id).toBe(1);
  expect(
    relatedCoverageParent(
      { ...child, summary: "Another infrastructure program receives $300 million in grants." },
      [parent]
    )
  ).toBeNull();
  expect(
    relatedCoverageParent(
      { ...child, sourceTiming: { ...timing, publisherPublishedDay: "2026-09-15" } },
      [parent]
    )
  ).toBeNull();
});
it("does not broadly approve the republication host or count an industry body as an official source", () => {
  expect(
    publisherWeight({
      title: "News",
      url: "https://www.nationaltribune.com.au/unreviewed/",
      source: "National Tribune",
    })
  ).toBe(0);
  expect(publisherWeight({ title: "News", url: "https://www.ausbanking.org.au/release/" })).toBe(8);
});
