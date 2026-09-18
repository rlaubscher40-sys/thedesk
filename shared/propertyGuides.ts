export type PropertyGuide = {
  slug: string;
  topic: string;
  title: string;
  intro: string;
  distinctions: { title: string; text: string }[];
  check: string;
  source: { title: string; url: string };
  search: string;
};

export const GUIDE_REVIEWED = "2026-09-18";
export const PROPERTY_GUIDES: PropertyGuide[] = [
  {
    slug: "interest-rates",
    topic: "Borrowing",
    title: "What does a rate change mean for a home loan?",
    intro:
      "Start with the loan rate and the remaining term. The cash rate alone cannot tell you what happens to a repayment.",
    distinctions: [
      {
        title: "Cash rate → lending rates",
        text: "The RBA cash rate concerns overnight lending between financial institutions. It influences other rates, alongside funding costs, competition and credit risk.",
      },
      {
        title: "Variable → fixed",
        text: "A lender can change a variable rate. An existing fixed-rate period does not automatically reprice when the cash rate moves.",
      },
      {
        title: "Rate → repayment",
        text: "The balance, remaining term and repayment type also matter. A lower payment after extending a term does not by itself establish a lower lifetime cost.",
      },
    ],
    check:
      "Does the report describe the cash rate, a new-loan offer or an existing borrower’s rate? Check when the lender’s change takes effect before treating it as a cash-flow change.",
    source: {
      title: "RBA · How monetary policy reaches the economy",
      url: "https://www.rba.gov.au/education/resources/explainers/the-transmission-of-monetary-policy.html",
    },
    search: "rates",
  },
  {
    slug: "housing-supply",
    topic: "Construction",
    title: "When does a housing announcement become a home?",
    intro:
      "Follow the stage of delivery. A proposal, an approval and a completed dwelling answer different questions.",
    distinctions: [
      {
        title: "Approved",
        text: "Permission is an early step. Approved dwellings may still be waiting to start; an approval count is not a count of homes available to occupy.",
      },
      {
        title: "Commenced",
        text: "Building work has started. Homes under construction remain in the pipeline until completion.",
      },
      {
        title: "Completed",
        text: "Completions describe finished building work. Read the geography, dwelling type and reporting period, and check whether the figures have been revised.",
      },
    ],
    check:
      "What stage does the headline count? Then check timing and whether the project replaces existing homes: gross construction and a net increase in housing are different claims.",
    source: {
      title: "ABS · Building Activity, Australia",
      url: "https://www.abs.gov.au/statistics/industry/building-and-construction/building-activity-australia/latest-release",
    },
    search: "housing",
  },
  {
    slug: "rents",
    topic: "Renting",
    title: "Why do rent measures tell different stories?",
    intro:
      "A newly advertised rental and a household’s existing rent are different observations. Check which one the headline measures.",
    distinctions: [
      {
        title: "Advertised rents",
        text: "Asking-rent measures track homes offered to new tenants. They do not describe every existing lease.",
      },
      {
        title: "Rents actually paid",
        text: "The ABS CPI rents measure includes new and existing tenancies, and private and government rents. Changes in advertised rents take time to flow through existing leases.",
      },
      {
        title: "Level → growth",
        text: "Slower rent growth still means rents are rising when the growth rate remains positive. It does not establish that the weekly dollar amount has fallen.",
      },
    ],
    check:
      "Compare the same geography, property type, period and measure. A national inflation figure cannot establish the asking rent for a particular suburb.",
    source: {
      title: "ABS · Measuring rents in the CPI (method explanation, June 2024)",
      url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/jun-quarter-2024",
    },
    search: "rent",
  },
  {
    slug: "population",
    topic: "Demand",
    title: "Do overseas arrivals equal population growth?",
    intro:
      "Travel movements, migration and housing demand are different measures. Keep the denominator attached to the number.",
    distinctions: [
      {
        title: "Trips → people",
        text: "Overseas arrivals and departures count border movements. The same person can make multiple trips.",
      },
      {
        title: "Net overseas migration",
        text: "The ABS uses changes in usual residence, including a 12-month stay within a 16-month period, to determine who enters or leaves the resident population.",
      },
      {
        title: "People → homes",
        text: "A population change is not a dwelling requirement on its own. Translating it into housing demand requires additional assumptions about households and location.",
      },
    ],
    check:
      "Is the number a travel count, migration estimate or population estimate? Do not turn a national migration figure into a local housing forecast without local evidence.",
    source: {
      title: "ABS · Use net overseas migration, not arrivals and departures",
      url: "https://www.abs.gov.au/articles/use-net-overseas-migration-statistics-understand-overseas-migration-not-overseas-arrivals-and-departures",
    },
    search: "migration",
  },
  {
    slug: "house-prices",
    topic: "Values",
    title: "What does a house-price index actually measure?",
    intro:
      "A market indicator describes a group of properties. It is not a valuation of every home in that group.",
    distinctions: [
      {
        title: "Median → index",
        text: "A median sale price can move when the mix of homes sold changes. Cotality’s hedonic indices adjust for property characteristics to help separate market movement from that mix.",
      },
      {
        title: "Month → year",
        text: "A monthly change and an annual change describe different windows. Check whether a headline concerns houses, units or all dwellings, and which geographic area it covers.",
      },
      {
        title: "Estimate → certainty",
        text: "An index can be revised as information improves. An area-wide change does not establish the sale price of a particular property or guarantee the next move.",
      },
    ],
    check:
      "Keep provider, measure, geography, dwelling type and period together. Compare like with like before deciding that two reports disagree.",
    source: {
      title: "Cotality · Property index methodology",
      url: "https://www.cotality.com/au/our-data/indices",
    },
    search: "prices",
  },
  {
    slug: "auctions",
    topic: "Selling",
    title: "How much can an auction clearance rate tell you?",
    intro:
      "Read the result alongside coverage and timing. A percentage alone hides how many outcomes are known.",
    distinctions: [
      {
        title: "Preliminary → final",
        text: "Early results are incomplete. Cotality updates its preliminary figures as more outcomes arrive and publishes final results on Thursday.",
      },
      {
        title: "Check the denominator",
        text: "Cotality includes known sales before, at or after auction in the numerator, and known results including passed-in and withdrawn auctions in the denominator. Check other providers’ definitions separately.",
      },
      {
        title: "Sample → market",
        text: "Auction results concern a particular selling method and sample. A small local set of auctions cannot establish conditions across all private-treaty sales or every suburb.",
      },
    ],
    check:
      "Compare the same provider’s final figures, auction volumes and geography. Treat a preliminary headline as provisional, especially when many results remain unreported.",
    source: {
      title: "Cotality · Auction results and calculation method",
      url: "https://www.cotality.com/au/our-data/auction-results",
    },
    search: "auction",
  },
  {
    slug: "housing-tenure",
    topic: "Housing policy",
    title: "Are social, public and community housing the same?",
    intro:
      "The labels overlap, but they do not identify the same ownership and management arrangements.",
    distinctions: [
      {
        title: "Social housing",
        text: "An umbrella for subsidised rental housing provided by government and non-government organisations to eligible households. Australia has several social-housing programs.",
      },
      {
        title: "Public housing",
        text: "Housing managed by state and territory housing authorities. The dwellings can be government-owned or leased.",
      },
      {
        title: "Community housing",
        text: "Housing managed by community organisations. Management by a community provider does not necessarily mean that provider owns the dwelling.",
      },
    ],
    check:
      "Ask who owns and manages the homes, who is eligible and what rent applies. Do not relabel an ‘affordable housing’ announcement as public housing without those details. Check replacements before calling it a net increase.",
    source: {
      title: "AIHW · Housing assistance in Australia 2026",
      url: "https://www.aihw.gov.au/reports/housing-assistance/housing-assistance-in-australia-2026/contents/housing-assistance",
    },
    search: "housing",
  },
];

export function propertyGuide(slug: string): PropertyGuide | undefined {
  return PROPERTY_GUIDES.find((guide) => guide.slug === slug);
}

/** Headline subject only; never infer a topic from a generated angle. */
export function guideForStory(title: string, channel?: string | null): PropertyGuide | undefined {
  if (channel && channel !== "AU" && channel !== "PROPERTY") return undefined;
  if (/\b(?:rent(?:al)? (?:rights|laws?|reforms?)|evict\w*|tenancy (?:rights|protections))\b/i.test(title)) return undefined;
  const rules: [RegExp, string][] = [
    [/\b(?:social|public|community|affordable) housing\b/i, "housing-tenure"],
    [/\b(?:cash rate|interest rates?|mortgages?|home loans?|refinanc\w*)\b/i, "interest-rates"],
    [/\b(?:auctions?|clearance rates?)\b/i, "auctions"],
    [/\b(?:migration|migrants?|population)\b/i, "population"],
    [/\b(?:house|home|housing|dwelling|property) (?:prices?|values?)\b/i, "house-prices"],
    [/\b(?:rents?|rental prices?|rental growth)\b/i, "rents"],
    [
      /\b(?:housing supply|homebuilding|home building|dwelling approvals?|housing approvals?|housing completions?|homes? (?:built|approved)|residential construction|housing construction|rezon\w*)\b/i,
      "housing-supply",
    ],
  ];
  const slug = rules.find(([pattern]) => pattern.test(title))?.[1];
  return slug ? propertyGuide(slug) : undefined;
}

export function guideArchiveHref(guide: PropertyGuide): string {
  return `/archive?cat=ALL&region=AU&q=${encodeURIComponent(guide.search)}&sort=latest`;
}
