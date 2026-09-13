import { expect, it } from "vitest";
import { auditedRecordCorrections } from "./auditedRecordCorrections";
import { checkClaimEvidence } from "./claimEvidence";
import { isInstitutionalBoilerplate } from "./sourceBoilerplate";
import { publisherWeight, editorialBeat, assessStory } from "./editorial";
import { SOURCES } from "../scripts/ingest/sources";
import { parseIndexSource } from "../scripts/ingest/lib/indexSource";

const row = {
  sourceUrl:
    "https://www.apra.gov.au/news-and-publications/apra-revises-proposals-implement-governments-retirement-reporting-framework",
  feedDate: "2026-09-10",
  whyItMatters:
    "From 2028, Australians will for the first time have published data on how super funds are supporting members through retirement, shifting accountability in a system holding $9.8 trillion.",
};
it("corrects only the verified APRA publication and exact old field", () => {
  expect(auditedRecordCorrections(row)).toEqual([
    {
      field: "whyItMatters",
      before: row.whyItMatters,
      after:
        "The proposed indicators would make super funds' retirement support more transparent, with APRA expecting initial publication in 2028.",
    },
  ]);
  expect(auditedRecordCorrections({ ...row, whyItMatters: "An editor corrected this." })).toEqual(
    []
  );
  expect(auditedRecordCorrections({ ...row, feedDate: "2026-09-11" })).toEqual([]);
  expect(auditedRecordCorrections({ ...row, sourceUrl: "https://example.com" })).toEqual([]);
});
it("does not transfer APRA-wide assets to the retirement system, including cached evidence", () => {
  const source = {
    title: "APRA retirement reporting",
    articleText:
      "Data publication is expected in 2028. APRA currently supervises institutions holding around $9.8 trillion in assets for Australian depositors, policyholders and superannuation fund members.",
  };
  expect(checkClaimEvidence(row.whyItMatters, source)).toContain("figure-scope");
  expect(
    checkClaimEvidence(
      "APRA-regulated institutions hold $9.8 trillion for depositors, policyholders and superannuation members.",
      source
    )
  ).toEqual([]);
  expect(
    checkClaimEvidence("Super funds hold $4.8 trillion.", {
      title: "Super assets",
      articleText: "Super funds hold $4.8 trillion.",
    })
  ).toEqual([]);
});
it("only recognises the institutional APRA footer, not substantive asset reporting", () => {
  expect(
    isInstitutionalBoilerplate(
      "The Australian Prudential Regulation Authority (APRA) is the prudential regulator of the financial services industry. APRA currently supervises institutions holding around $9.8 trillion in assets."
    )
  ).toBe(true);
  expect(
    isInstitutionalBoilerplate("APRA reports that superannuation assets rose to $4.8 trillion.")
  ).toBe(false);
});
it("reviews Pulse as a newsroom without treating it as a regulator", () => {
  expect(
    publisherWeight({
      title: "Tasmania short-stay levy",
      sourceUrl: "https://pulsetasmania.com.au/news/story/",
    })
  ).toBe(8);
});
it("recognises short-stay law reviews without admitting holiday reviews or redating old events", () => {
  const title = "Lower house votes for urgent review of Tasmania's short-stay accommodation laws";
  expect(editorialBeat(title)).toBe("policy");
  expect(editorialBeat("Review: the best short-stay accommodation for your holiday")).toBeNull();
  const article = {
    title,
    channel: "PROPERTY",
    sourceUrl: "https://pulsetasmania.com.au/news/review/",
    articleText:
      "Tasmania's parliament has called for a review of short-stay accommodation laws. The motion is not binding. It calls for submissions on the effect of short-stay accommodation on rental housing supply. ".repeat(
        4
      ),
    sourceTiming: {
      publisherDateStatus: "available" as const,
      publisherPublishedAt: "2026-09-09T06:24:38Z",
      feedReportedAt: null,
      retrievedAt: "2026-09-13T10:00:00Z",
    },
  };
  expect(assessStory(article, new Date("2026-09-13T10:00:00Z")).reason).toBe(
    "old-or-future-publisher-date"
  );
});
it("discovers only same-publisher news links from the reviewed politics index", () => {
  const source = SOURCES.find((s) => s.name === "Pulse Tasmania Politics")!;
  const rows = parseIndexSource(
    '<h2><a href="/news/short-stay-levy/">Tasmania debates short-stay levy changes</a></h2><a href="/section/politics/">All Tasmanian politics reporting</a><a href="https://elsewhere.example/news/fake/">Tasmania debates short-stay levy changes</a>',
    source
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    url: "https://pulsetasmania.com.au/news/short-stay-levy/",
    isoDate: null,
    discovery: "publisher-index",
  });
});
