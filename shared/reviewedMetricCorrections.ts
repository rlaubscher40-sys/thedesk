/** Exact live rows reviewed against ABS release tables on 17 September 2026.
 * Preserve observation dates and later collection/editor changes. */
export const REVIEWED_METRIC_CORRECTIONS = [
  {
    metricKey: "wage_growth",
    asOf: "2026-06-01T00:00:00.000Z",
    sourceUrl:
      "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/wage-price-index-australia/latest-release",
    before: { value: "0.8", context: "ABS quarterly" },
    after: { value: "3.2", context: "ABS · annual change · all sectors · seasonally adjusted" },
    issuedOn: "2026-09-17",
    reference: "Data · Wage growth (WPI), June 2026",
    what: "The wage-growth collector selected the 0.8% quarterly movement for a metric intended to track annual wage growth. Its period description was ambiguous.",
    now: "The June 2026 observation shows 3.2% annual growth in the seasonally adjusted all-sector Wage Price Index. Collection now checks the named annual column and reference quarter. Historical stored samples and previously distributed material have not been recast as verified annual observations.",
  },
  {
    metricKey: "net_migration",
    asOf: "2026-03-01T00:00:00.000Z",
    sourceUrl:
      "https://www.abs.gov.au/statistics/people/population/national-state-and-territory-population/latest-release",
    before: { value: "292,100", context: "ABS quarterly · NOM" },
    after: {
      value: "292,137",
      context: "ABS · year ending reference quarter · Australia · persons",
    },
    issuedOn: "2026-09-17",
    reference: "Data · Net overseas migration, year to March 2026",
    what: "The quarterly release label did not make clear that the migration figure covered a full year. The collector used the rounded release summary.",
    now: "The metric identifies annual net overseas migration and uses the table's 292,137 persons for the year to March 2026. This is a period-label clarification and increased precision, not a newly measured increase in migration. Historical stored samples and distributed material remain unchanged.",
  },
] as const;
