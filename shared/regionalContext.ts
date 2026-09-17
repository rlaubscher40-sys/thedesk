/** Reviewed primary-source context, separate from the automated news sample.
 * Dates are publication dates, never crawl dates. These are not price signals.
 * Adding an entry requires reading the original and preserving its qualifications. */
export const REGIONAL_CONTEXT = [
  {
    market: "townsville",
    title: "Social and affordable housing construction",
    publisher: "Queensland Government",
    publishedOn: "2026-07-09",
    reviewedOn: "2026-09-17",
    sourceUrl: "https://statements.qld.gov.au/statements/105504",
    summary:
      "The government reported 253 social and affordable homes under construction in Townsville. Its examples included 13 social homes at Kelso and 24 at Rasmussen.",
    limitation:
      "A dated government construction update, not a count of homes completed or available to rent today. The examples are part of the pipeline, not additional to it.",
  },
  {
    market: "townsville",
    title: "Defence Housing Australia's local leasing requirements",
    publisher: "Defence Housing Australia",
    publishedOn: "2026-08-19",
    reviewedOn: "2026-09-17",
    sourceUrl:
      "https://www.dha.gov.au/investing/investor-resources/investor-news/spotlight-townsville-qld-0",
    summary:
      "DHA reported that it was seeking Townsville rental properties, including houses around the Ring Road corridor and apartments or townhouses suitable for single Defence members.",
    limitation:
      "First-party investor marketing by a housing operator, not independent market analysis. Its broader price, vacancy and yield claims are not adopted here; availability and lease terms require separate checks.",
  },
  {
    market: "newcastle",
    title: "Proposed landslip planning controls at New Lambton",
    publisher: "City of Newcastle",
    publishedOn: "2026-09-15",
    reviewedOn: "2026-09-17",
    sourceUrl:
      "https://newcastle.nsw.gov.au/about-us/news-and-updates/latest-news/media-statement-%E2%80%93-new-lambton-landslip-planning-proposal",
    summary:
      "Council proposed planning controls for land near the New Lambton landslip zone. Its statement scheduled consideration for 22 September, followed by a state gateway decision and public exhibition if the proposal progresses.",
    limitation:
      "This records a proposal, not enacted controls or a citywide hazard assessment. Check the current planning record before relying on the position for a particular property.",
  },
  {
    market: "newcastle",
    title: "Funding announced for the Union Street streetscape",
    publisher: "NSW Government",
    publishedOn: "2026-07-21",
    reviewedOn: "2026-09-17",
    sourceUrl:
      "https://www.nsw.gov.au/ministerial-releases/minns-labor-government-invests-54-million-to-fast-track-community-infrastructure-to-support-housing",
    summary:
      "The state's Round One funding table allocated $3 million to Newcastle's Union Street streetscape renewal in Wickham, described as public-space and access improvements supporting housing growth.",
    limitation:
      "A funding allocation for supporting infrastructure, not $3 million of home construction, completed works or evidence of a price uplift.",
  },
] as const;

function validDay(day: string): boolean {
  const time = Date.parse(`${day}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === day
  );
}

export function regionalContext(market: string, asOf: string) {
  if (!validDay(asOf)) return [];
  return REGIONAL_CONTEXT.filter(
    (entry) => entry.market === market && entry.publishedOn <= asOf && entry.reviewedOn <= asOf
  ).map((entry) => ({
    ...entry,
    // Retain an explicitly dated record, never silently certify ongoing status.
    reviewDue: Date.parse(asOf) - Date.parse(entry.reviewedOn) >= 30 * 86_400_000,
  }));
}
