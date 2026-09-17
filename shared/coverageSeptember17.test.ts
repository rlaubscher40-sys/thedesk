import { expect, it } from "vitest";
import { auditedRecordCorrections } from "./auditedRecordCorrections";

it("corrects the reviewed migration inference only on the exact old record", () => {
  const row = {
    sourceUrl:
      "https://www.sbs.com.au/news/article/temporary-migrants-cuts-voting-rights-one-nation/97u096arb",
    feedDate: "2026-09-17",
    sayThis:
      "One Nation's plan to cut 270,000 graduate visa holders to 40,000 would hollow out university revenue and, with it, a quiet pillar of inner-city rental demand.",
  };
  const changes = auditedRecordCorrections(row);
  expect(changes).toHaveLength(1);
  expect(changes[0]?.after).toContain("not an enacted change");
  expect(auditedRecordCorrections({ ...row, sourceUrl: row.sourceUrl + "-other" })).toEqual([]);
  expect(auditedRecordCorrections({ ...row, feedDate: "2026-09-16" })).toEqual([]);
  expect(auditedRecordCorrections({ ...row, sayThis: "An editor's subsequent revision" })).toEqual(
    []
  );
  expect(auditedRecordCorrections({ ...row, sayThis: changes[0]!.after })).toEqual([]);
});

it("removes the duplicated Westpac finding while keeping its period and uncertainty", () => {
  const changes = auditedRecordCorrections({
    sourceUrl: "https://www.westpaciq.com.au/economics/2026/09/leading-index-september-2026",
    feedDate: "2026-09-17",
    summary:
      "The six-month annualised growth rate in the Westpac-Melbourne Institute Leading Index, which indicates the likely pace of economic activity relative to trend three to nine months into the future, lifted to -0.09% in August from -0.17% in July. Leading Index growth rate lifts to -0.09% in August from -0.17% in July.",
  });
  expect(changes).toHaveLength(1);
  expect(changes[0]?.after).toContain("-0.09% in August from -0.17% in July");
  expect(changes[0]?.after).toContain("may not be sustained");
});
