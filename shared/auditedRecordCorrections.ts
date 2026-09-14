/** Source-verified corrections from the September coverage audits.
 * Match the exact publication and old field; preserve later editorial edits.
 * No source request, model generation or new publication during startup. */
type Field = "title" | "summary" | "partnerTag" | "sayThis" | "whyItMatters" | "counterpoint";
type Correction = { field: Field; before: string; after: string | null };
const records: Array<{ sourceUrl: string; feedDate: string; changes: Correction[] }> = [
  {
    sourceUrl: "https://www.ausbanking.org.au/preparing-for-the-removal-of-card-surcharging/",
    feedDate: "2026-09-14",
    changes: [
      {
        field: "whyItMatters",
        before: "Businesses absorbing an estimated $660 million in annual surcharge revenue will face margin pressure from 1 October 2026, with lower interchange caps partially offsetting the cost.",
        after: "The ABA says lower payment costs are expected to help offset the removal of card surcharges by an estimated $660 million a year. That figure describes payment-cost savings, not lost surcharge revenue.",
      },
      {
        field: "sayThis",
        before: "From 1 October 2026, the price on the tag is the price you pay at the register, full stop.",
        after: "The ABA is reminding businesses to remove surcharges on eftpos, Visa and Mastercard payments from 1 October 2026. This is an implementation reminder, not a newly announced ban.",
      },
    ],
  },
  {
    sourceUrl: "https://www.nationaltribune.com.au/wa-housing-and-rental-affordability-at-record-lows/",
    feedDate: "2026-09-14",
    changes: [
      {
        field: "whyItMatters",
        before: "Investor lending fell 5.1 per cent in the June 2026 quarter after federal tax changes, and rental supply is barely back to its February 2021 peak while Perth's population has grown 12 per cent since then.",
        after: "REIWA reports that WA families needed 47.5 per cent of income for mortgage repayments and 25.0 per cent for median rent in the June 2026 quarter. These are quarterly affordability measures, not September price changes.",
      },
      {
        field: "sayThis",
        before: "WA borrowers now need 47.5 per cent of family income to cover mortgage repayments, a record high and the steepest single-quarter drop in affordability of any state.",
        after: "WA's mortgage-repayment share reached a record 47.5 per cent of family income in the June 2026 quarter, up 1.6 percentage points. REIWA says WA had the largest affordability decline among states and territories in that quarter.",
      },
    ],
  },
  {
    sourceUrl:
      "https://www.abc.net.au/news/2026-09-14/asx-markets-business-live-news-september-14/107148618",
    feedDate: "2026-09-14",
    changes: [
      {
        field: "title",
        before:
          "Markets live updates: Wall Street rises despite hot inflation likely to trigger a Fed rate hike this week - ABC News & Headlines - Australian Broadcasting Corporation",
        after: "Wall Street rises as US rate expectations firm",
      },
      {
        field: "summary",
        before:
          "The odds of the US Federal Reserve raising interest rates this week jumped to an almost sure thing after August inflation data came in higher than expected.",
        after:
          "ABC's 14 September liveblog reported Wall Street's gains at the preceding US market close and firmer expectations of a Federal Reserve rate rise. This is overseas market reporting, not an Australian policy decision.",
      },
      {
        field: "partnerTag",
        before:
          "Buying: A Fed hike this week keeps upward pressure on Australian fixed-rate mortgage pricing, narrowing the window on competitive deals.\nHolding: If the RBA reads sustained US inflation as cover for its own policy, variable-rate relief stays further away than many expect.\nWatching: The signal to watch is not the Fed decision itself but whether Australian bond yields move in sympathy in the days after.",
        after: null,
      },
      {
        field: "sayThis",
        before:
          "Wall Street shrugged off near-certain Fed hike odds, but the move that matters for Australian borrowers is what follows the Fed's decision, not the decision itself.",
        after: null,
      },
      {
        field: "whyItMatters",
        before:
          "A near-certain Fed hike, with Wall Street still rising, tells you markets are pricing the end of the cycle, not the hike itself, and that read flows directly into Australian rate expectations.",
        after: null,
      },
      {
        field: "counterpoint",
        before:
          "Markets rallying into a hike have been wrong before. If August inflation is a trend rather than a blip, the Fed funds rate has further to go and bond markets are under-pricing it.",
        after: null,
      },
    ],
  },
  {
    sourceUrl:
      "https://www.housingaustralia.gov.au/media/housing-australia-welcomes-australian-governments-additional-300-million-commitment-deliver",
    feedDate: "2026-09-14",
    changes: [
      {
        field: "whyItMatters",
        before:
          "With $614.6 million approved across 115 projects as at 31 July 2026, the program's scale is real, but 968 dwellings spread nationally over 20 years leaves the structural shortfall in crisis accommodation largely intact.",
        after:
          "The 968 approved dwellings are expected to assist more than 35,000 people over 20 years; that is a service horizon, not a stated construction timetable.",
      },
    ],
  },
  {
    sourceUrl:
      "https://www.brokernews.com.au/news/breaking-news/housing-australia-unlocks-fresh-funding-for-crisis-and-transitional-housing-289963.aspx",
    feedDate: "2026-09-14",
    changes: [
      {
        field: "sayThis",
        before:
          "One in three people seeking emergency housing in 2024-25 went unassisted. An extra $300 million adds roughly 500 beds to a system already short by tens of thousands.",
        after:
          "Converting $300 million in existing loans to grants is intended to support around 500 additional crisis and transitional homes, not 500 beds.",
      },
    ],
  },
  {
    sourceUrl:
      "https://www.apra.gov.au/news-and-publications/apra-revises-proposals-implement-governments-retirement-reporting-framework",
    feedDate: "2026-09-10",
    changes: [
      {
        field: "whyItMatters",
        before:
          "From 2028, Australians will for the first time have published data on how super funds are supporting members through retirement, shifting accountability in a system holding $9.8 trillion.",
        after:
          "The proposed indicators would make super funds' retirement support more transparent, with APRA expecting initial publication in 2028.",
      },
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
