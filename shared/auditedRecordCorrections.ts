/** Source-verified corrections from the 12 September coverage audit.
 * Match the exact publication and old field; preserve later editorial edits.
 * No source request, model generation or new publication during startup. */
type Field = "title" | "summary" | "partnerTag" | "sayThis" | "whyItMatters" | "counterpoint";
type Correction = { field: Field; before: string; after: string | null };
const records: Array<{ sourceUrl: string; feedDate: string; changes: Correction[] }> = [
  {
    sourceUrl:
      "https://www.apra.gov.au/news-and-publications/apra-revises-proposals-implement-governments-retirement-reporting-framework",
    feedDate: "2026-09-10",
    changes: [
      {
        field: "counterpoint",
        before:
          "Streamlined reporting and a new practice guide still leave funds two years before data collection even begins, plenty of time for the framework to be softened further.",
        after:
          "APRA expects data collection to begin in late 2027, followed by the first published indicators in 2028. These remain proposed milestones subject to the final consultation.",
      },
    ],
  },
  {
    sourceUrl:
      "https://www.abc.net.au/news/2026-09-11/asx-markets-business-news-live-updates/107136846",
    feedDate: "2026-09-12",
    changes: [
      {
        field: "title",
        before: "ASX drops, Nikkei plunges as oil prices and bond yields surge - as it happened",
        after: "ASX ends lower at the 11 September close",
      },
      {
        field: "summary",
        before:
          "The Nikkei has plunged, while the Bank of Japan is set to raise interest rates next week, most likely by 25 basis points.",
        after:
          "At the 11 September 2026 close, Australian shares fell 0.9% to 8,741 points, according to ABC. Materials fell 3.3% and real estate fell 1.2%, while financials gained 1%.",
      },
      {
        field: "partnerTag",
        before:
          "Buying: Borrowing capacity is being squeezed from two directions, so the gap between what you can borrow now and in six months may be meaningful.\nHolding: Real estate was the second-worst sector on the ASX today, and rising global yields tend to compress property valuations before they touch rents.\nWatching: The signal to watch is whether the RBA follows global central banks higher , a Fed hike next week, if it lands, narrows the RBA's room to stay still.",
        after: null,
      },
      {
        field: "sayThis",
        before:
          "Oil above $108, the Bank of Japan hiking next week, and Australian real estate already down 1.2% on the day , the rate pressure is no longer abstract.",
        after: null,
      },
      {
        field: "whyItMatters",
        before:
          "Brent crude above $108 and multi-year highs in US bond yields arriving together is the combination that historically delays rate cuts and prolongs mortgage pressure.",
        after: null,
      },
    ],
  },
];
export function auditedRecordCorrections(
  row: { sourceUrl?: string | null; feedDate: string } & Partial<Record<Field, string | null>>
): Correction[] {
  return (
    records
      .find((r) => r.sourceUrl === row.sourceUrl && r.feedDate === row.feedDate)
      ?.changes.filter((c) => row[c.field] === c.before) ?? []
  );
}
