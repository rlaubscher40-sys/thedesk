/** Source-reviewed corrections. Exact prior values protect later manual edits. */
export const REVIEWED_STORY_CORRECTIONS = [
  {
    id: 3900020,
    sourceUrl:
      "https://www.abc.net.au/news/2026-09-15/rba-inflation-economy-interest-rates/107151344",
    issuedOn: "2026-09-16",
    reference: "Story 3900020",
    what: "The standfirst repeated an opening bloodletting analogy instead of the economic argument.",
    now: "The website standfirst now describes the argument. The unsupported social hook has been withdrawn. The previously published Instagram slide still contains the original excerpt.",
    fields: [
      {
        field: "summary",
        before:
          'Bloodletting is an ancient therapy, dating back at least three millennia, and traditionally used to "cure" a range of ills.',
        after:
          "The ABC analysis examines why higher interest rates may not resolve the supply-side pressures contributing to inflation.",
      },
      {
        field: "sayThis",
        before:
          "The RBA may lift rates on 29 September because AI data centres are driving a construction boom it cannot control and will not benefit from.",
        after: null,
      },
    ],
  },
  {
    id: 3870132,
    sourceUrl: "https://statements.qld.gov.au/statements/106047",
    issuedOn: "2026-09-16",
    reference: "Story 3870132",
    what: "The standfirst contained a ministerial byline, and reader angles assigned an unsupported settlement timetable.",
    now: "The website distinguishes enabling funding and potential housing capacity from completed homes; the unsupported reader angles are withdrawn.",
    fields: [
      {
        field: "summary",
        before:
          "Deputy Premier, Minister for State Development, Infrastructure and Planning and Minister for Industrial Relations The Honourable Jarrod Bleijie",
        after:
          "Queensland announced $70 million in enabling infrastructure for projects with capacity for 710 homes across South Burnett and Somerset. This is infrastructure funding, not a count of completed homes.",
      },
      {
        field: "partnerTag",
        before:
          "Buying: Regional Queensland supply is growing, but these 710 lots are years from settlement, so near-term pricing pressure in those markets persists.\nHolding: Owners in Kingaroy, Cherbourg and Kilcoy face more competing stock eventually, which moderates any assumption of continued capital growth.\nWatching: The signal here is government willingness to fund enabling infrastructure at scale; watch whether similar rounds target SEQ corridors where demand is heavier.",
        after: null,
      },
      {
        field: "whyItMatters",
        before:
          "The Residential Activation Fund has now attributed capacity for more than 163,000 homes statewide, but the gap between infrastructure funding and actual completions is where Queensland's housing shortfall lives.",
        after:
          "Enabling infrastructure can support the housing pipeline, but the announcement does not establish a completion or settlement date for all 710 homes.",
      },
      {
        field: "sayThis",
        before:
          "Seventy million dollars of trunk infrastructure in regional Queensland tells you something about where the supply constraint actually sits: not land, but pipes and roads.",
        after: null,
      },
    ],
  },
  {
    id: 3900004,
    sourceUrl:
      "https://www.nationaltribune.com.au/wa-housing-and-rental-affordability-at-record-lows/",
    issuedOn: "2026-09-16",
    reference: "Story 3900004",
    what: "A reader angle attributed the full repayment increase to rate rises alone.",
    now: "The website preserves the source’s two drivers: rate rises and a higher average loan size.",
    fields: [
      {
        field: "partnerTag",
        before:
          "Buying: The average WA first home buyer loan hit $610,941 in the June 2026 quarter, up 16.3 per cent on a year ago.\nHolding: Three rate rises in 2026 have added over $1,000 to monthly repayments compared with the June 2025 quarter.\nWatching: REIWA flagged that market conditions have eased in recent months, so flat prices combined with a rate pause is the clearest early signal to watch.",
        after:
          "Buying: The average WA first home buyer loan hit $610,941 in the June 2026 quarter, up 16.3 per cent on a year ago.\nHolding: Rate rises and a higher average loan size together increased monthly repayments by over $1,000 compared with the June 2025 quarter.\nWatching: REIWA flagged that market conditions have eased in recent months, so flat prices combined with a rate pause is the clearest early signal to watch.",
      },
    ],
  },
] as const;
