/** Reviewed corrections. Exact prior values protect later manual edits. */
export const REVIEWED_STORY_CORRECTIONS = [
  {
    id: 3000015,
    sourceUrl:
      "https://www.theguardian.com/business/grogonomics/2026/aug/12/isnt-it-amazing-what-a-policy-that-actually-tackles-the-cause-of-outrageous-house-prices-can-do",
    issuedOn: "2026-09-18",
    reference: "Story 3000015",
    what: "The summary presented an opinion as the publication’s own factual conclusion. The affordability estimate lost its conditional character and mixed-source attribution; the counterpoint added unsupported certainty about structural reform and future policy effects.",
    now: "The summary now identifies the article type, the conditional estimate is qualified and the unsupported counterpoint is withdrawn. Original article checked in an AI-assisted source review on 18 September 2026; this is not human verification. Distributed copies remain unchanged.",
    fields: [
      {
        field: "summary",
        // Reviewed against the public excerpt, which removes publisher promotions.
        matchPublicExcerpt: true,
        before:
          "Labor has shown what a government can do to improve housing affordability, exposing how pathetic previous attempts had been. For the first time in 25 years, an Australian government actually did something about housing based on the idea that the only way to make houses more affordable is for house prices to fall. They stopped pretending there was another way.",
        after: "An opinion column about housing policy and affordability.",
      },
      {
        field: "whyItMatters",
        before:
          "ANZ projects a 10.6% average capital city price fall by end of 2027, with dwelling costs dropping from 17.3 to 14.7 years of household income, the sharpest two-year affordability improvement since 1970.",
        after:
          "This estimate combines forecasts from different sources; it is conditional, rather than an observed outcome.",
      },
      {
        field: "counterpoint",
        before:
          "ANZ's own forecast has prices rising 4.3% in 2028, which means this is a managed correction, not structural reform, and the affordability problem resurfaces the moment policy pressure eases.",
        after: null,
      },
    ],
  },

  {
    id: 3960095,
    sourceUrl:
      "https://www.mpamag.com/au/news/general/afg-continues-run-with-12bn-mortgage-backed-securitisation/590239",
    issuedOn: "2026-09-18",
    reference: "Story 3960095",
    what: "The reader angles inferred comparative loan pricing, sector-wide capital strength and mortgage quality from one lender's funding transaction. The counterpoint asserted a repricing speed not established by the article.",
    now: "Those interpretations are withdrawn. The funding transaction and attributed figures remain. The revised context distinguishes one company's growth from market share and borrower outcomes. The full original article was checked on 18 September 2026 using an AI-assisted source review, not human verification. Already distributed copies are unchanged.",
    fields: [
      {
        field: "whyItMatters",
        before:
          "AFG Securities' book grew 30% over the year to a record $7.1 billion, meaning a non-bank lender is becoming a structurally larger force in the prime mortgage market.",
        after:
          "The reported growth concerns AFG Securities' own loan book. It does not establish its market share or the rates available to an individual borrower.",
      },
      {
        field: "counterpoint",
        before:
          "A $13.1 billion RMBS program funded at competitive spreads depends on credit markets staying open; a risk-off move would reprice that funding fast.",
        after:
          "The article reports a funding transaction, not a comparison of borrower rates or a sector-wide assessment of lenders' capital strength.",
      },
      {
        field: "partnerTag",
        before:
          "Buying: AFG can price loans off its own balance sheet, which can support more competitive rates than commission-based aggregators.\nHolding: A growing non-bank funding pool signals lenders outside the big four remain well-capitalised to compete on refinancing.\nWatching: Sustained international appetite for Australian prime RMBS at this volume is a confidence signal on domestic mortgage book quality.",
        after: null,
      },
    ],
  },

  {
    id: 3960085,
    sourceUrl: "https://www.nsw.gov.au/ministerial-releases/new-social-homes-hurstville",
    issuedOn: "2026-09-18",
    reference: "Story 3960085",
    what: "Reader angles inferred effects on individual purchase timelines and comparable sale values from a social-housing proposal. The demand figures also lost the source's more-than qualification.",
    now: "The unsupported reader angles are withdrawn. The briefing preserves the qualified demand figures and identifies the homes as proposed, with consultation and planning still ahead. The original announcement remains linked; already distributed copies are not rewritten.",
    fields: [
      {
        field: "whyItMatters",
        before:
          "With 1,500 households on the Georges River Housing Register including 400 priority applicants, 180 dwellings addresses a fraction of documented local demand.",
        after:
          "The release reports more than 1,500 households on the Georges River Housing Register, including more than 400 priority applicants. Around 180 proposed homes would address only part of that reported demand.",
      },
      {
        field: "counterpoint",
        before:
          "A community feedback period open until 28 September 2026, followed by a separate formal DA exhibition, means the gap between announcement and construction start is still completely open.",
        after:
          "Early feedback closes on 28 September 2026, before a State Significant Development Application is lodged and formally exhibited. The release does not provide a construction start or completion date.",
      },
      {
        field: "sayThis",
        before:
          "180 social homes on a vacant rail site in Hurstville, but the early-feedback window closes 28 September 2026 and a formal DA still has to clear planning.",
        after:
          "Around 180 social homes are proposed for a former rail site in Hurstville. Early feedback closes on 28 September 2026, before the development application is lodged.",
      },
      {
        field: "partnerTag",
        before:
          "Buying: The site is pre-DA, so no new supply pressure in Hurstville arrives soon enough to affect your purchase timeline.\nHolding: Concentrated social housing additions in Georges River are unlikely to shift comparable sale values materially while overall supply remains tight.\nWatching: Track whether the State Significant Development Application gets lodged and exhibited; that is the stage where the real delivery timeline becomes legible.",
        after: null,
      },
    ],
  },
  {
    id: 3930103,
    sourceUrl:
      "https://www.realestate.com.au/news/hasnt-stopped-sydney-suburbs-defying-price-slump/",
    issuedOn: "2026-09-18",
    reference: "Story 3930103",
    what: "The counterpoint attributed annual suburb gains to a low starting base without source support. Reader angles also asserted a recovery and policy-driven price effects beyond the attributed reporting.",
    now: "Those interpretations have been withdrawn. The source-supported headline and summary remain, with the original article linked. Already distributed copies are not rewritten.",
    fields: [
      {
        field: "counterpoint",
        before:
          "Strong twelve-month figures in Wentworth Falls and Ingleburn partly reflect how low the base was , not necessarily a new structural demand shift.",
        after: null,
      },
      {
        field: "partnerTag",
        before:
          "Buying: The federal deposit scheme's $1.5m Sydney cap is concentrating first-home buyer demand into outer and mid-ring suburbs, lifting prices there.\nHolding: If you own in an affordable pocket like the outer west or Blue Mountains, your equity may be moving against the city-wide trend.\nWatching: Outer suburbs leading a downturn recovery signals where affordability pressure concentrates first , watch whether inner-ring units follow the same trajectory.",
        after: null,
      },
    ],
  },
  {
    id: 3960030,
    sourceUrl:
      "https://www.realestate.com.au/news/homeowners-switch-to-interest-only-as-families-roll-debts-into-mortgages/",
    issuedOn: "2026-09-18",
    reference: "Story 3960030",
    what: "The summary began with an unidentified speaker. Interpretation, the talking point and reader angles extrapolated one broker's examples into broad claims about household stress, neighbours' equity, housing supply and price outcomes.",
    now: "The standfirst identifies the reported subject. The talking point identifies the sample limitation, and the unsupported market-wide conclusions and reader angles are withdrawn. The original reporting remains linked; already distributed copies are not rewritten.",
    fields: [
      {
        field: "summary",
        before:
          "He said homeowners were switching to interest only mortgages just to survive and free up cash each month. Homeowners are under extreme money flow pressures with interest rate hikes and modest wage growth.",
        after:
          "The report describes homeowners switching to interest-only mortgages and consolidating other debts into their home loans.",
      },
      {
        field: "whyItMatters",
        before:
          "When owner-occupiers, not investors, are the dominant interest-only applicants and are rolling consumer debt into 30-year loans, the stress is structural, not a rate-cycle blip.",
        after:
          "The reported refinancing examples describe household cash-flow pressure. They do not establish how widespread that pressure is or whether it is structural.",
      },
      {
        field: "counterpoint",
        before:
          "Families consolidating debt and staying in their homes are not distressed sellers, which means the supply shock that would drive a price correction is still not materialising.",
        after: null,
      },
      {
        field: "sayThis",
        before:
          "Stretching a credit card over 30 years is not a debt solution, it is a sign of how far into the buffer zone Brisbane families have already moved.",
        after:
          "The report describes one Brisbane broker's clients, not a representative measure of household stress.",
      },
      {
        field: "partnerTag",
        before:
          "Buying: Sellers staying put rather than distress-selling keeps stock tight, so the price relief you are waiting for may not arrive.\nHolding: More than half of one Brisbane broker's recent refinances rolled short-term debt into the mortgage, which tells you how many neighbours are quietly burning equity.\nWatching: Five consecutive months of national price falls alongside record-low affordability is the kind of divergence that historically resolves one way or the other, not both.",
        after: null,
      },
    ],
  },
  {
    id: 3960015,
    sourceUrl: "https://www.realestate.com.au/news/big-banks-hike-rates-days-from-rba-decision/",
    issuedOn: "2026-09-18",
    reference: "Story 3960015",
    what: "The standfirst quoted a rate forecast without distinguishing it from a decision. The talking point and reader angles overstated what advertised fixed-rate changes established about RBA timing and borrowers' future repayments.",
    now: "The summary and talking point distinguish forecasts from announced decisions. Unsupported timing and borrower-outcome angles are withdrawn. The original reporting remains linked; already distributed copies are not rewritten.",
    fields: [
      {
        field: "summary",
        before:
          'This as Canstar.com.au data insights director Sally Tindall warned "the big question at this stage is not if the RBA will hike again, but when" - with latest rate moves by banks a clear sign they\'re now bracing for impact.',
        after:
          "The report quotes Canstar data insights director Sally Tindall expecting a further RBA hike. That is a forecast, not an announced decision.",
      },
      {
        field: "sayThis",
        before:
          "Nine banks have already moved on fixed rates this month, and the spread between fixed and variable is now the market's clearest signal on RBA timing.",
        after:
          "Fixed-rate offers changed ahead of an RBA meeting; the report's cash-rate timing remains a forecast.",
      },
      {
        field: "partnerTag",
        before:
          "Buying: Variable rates still sit below 6 per cent at some lenders, but that window narrows if the RBA moves in November.\nHolding: A November cash rate rise of 0.25 per cent would add to repayments on any variable loan still held after the fixed cliff.\nWatching: The gap between fixed and variable closing further would confirm the market has priced a hike as imminent rather than probable.",
        after: null,
      },
    ],
  },
  {
    fields: [
      {
        after:
          "Queensland opened a Register of Interest for land in Glenden and introduced legislation to repeal worker-accommodation obligations on the Byerwen mine. The release describes a bill introduced to Parliament, not a completed repeal.",
        before:
          "The Crisafulli Government is delivering a practical pathway forward for Glenden, opening a Register of Interest for parties interested in buying land.",
        field: "summary",
      },
      {
        after:
          "Queensland has introduced a bill to remove the Byerwen mine’s worker-accommodation obligations and opened a Register of Interest for Glenden land.",
        before:
          "Queensland just stripped a coal mine's obligation to house workers in a struggling town, and opened the land to anyone who wants it instead.",
        field: "sayThis",
      },
      {
        after:
          "The announcement combines proposed changes to worker-accommodation obligations with a land registration process. It does not establish that the repeal has passed or that private investment will follow.",
        before:
          "Whether repealing a mandated workforce-housing obligation revives or further hollows out Glenden depends on private-sector appetite that has not yet been tested.",
        field: "whyItMatters",
      },
      {
        after: null,
        before:
          "Removing QCoal's obligation to house workers there reduces the one guaranteed source of local economic activity, which is the opposite of a revival plan.",
        field: "counterpoint",
      },
    ],
    id: 3960063,
    issuedOn: "2026-09-17",
    now: "The website distinguishes a bill introduced to Parliament from an enacted repeal, and withdraws the unsupported economic claim. Already distributed copies are not rewritten.",
    reference: "Story 3960063",
    sourceUrl: "https://statements.qld.gov.au/statements/106053",
    what: "Reader commentary described proposed legislation as an already completed removal of worker-housing obligations and asserted a guaranteed local economic effect.",
  },
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
  {
    id: 3930102,
    sourceUrl:
      "https://www.sbs.com.au/news/article/temporary-migrants-cuts-voting-rights-one-nation/97u096arb",
    issuedOn: "2026-09-17",
    reference: "Story 3930102",
    what: "The standfirst lost the speaker's attribution. Reader commentary conflated graduate visas with student revenue and asserted local rental effects beyond the source's evidence.",
    now: "The website identifies the policy as a proposal, distinguishes its student and graduate components, and states that SBS does not establish the size, location or timing of rental effects. Previously distributed copies are not changed by this website correction.",
    fields: [],
  },
  {
    id: 3930101,
    sourceUrl: "https://www.westpaciq.com.au/economics/2026/09/leading-index-september-2026",
    issuedOn: "2026-09-17",
    reference: "Story 3930101",
    what: "The summary repeated the index movement, and reader commentary inferred mortgage-rate timing and support for property values from the index.",
    now: "The website retains the August and July readings and Westpac's uncertainty. It clarifies that the index does not establish local property values or a mortgage-relief timetable.",
    fields: [],
  },
  {
    id: 3960032,
    sourceUrl:
      "https://www.realestate.com.au/news/brisbane-2032-the-inner-city-suburb-rezoned-for-27000-new-homes/",
    reviewSourceUrl: "https://statements.qld.gov.au/statements/106069",
    issuedOn: "2026-09-17",
    reference: "Story 3960032",
    what: "The headline and talking point treated proposed Bowen Hills planning changes as implemented. The summary instead described Woolloongabba, and reader angles asserted unsupported timing and price effects.",
    now: "The website identifies Bowen Hills' changes as proposed, distinguishes projected capacity from delivery, and withdraws the unsupported reader angles. Already distributed copies are not rewritten.",
    fields: [
      {
        after: null,
        before:
          "Height limits rising on paper and towers rising on site are different things; feasibility concerns that UDIA flagged for inner-city delivery have not disappeared with rezoning.",
        field: "counterpoint",
      },
      {
        after: "Bowen Hills planning changes proposed for capacity of up to 27,000 homes",
        before: "Brisbane 2032: The inner-city suburb rezoned for 27,000 new homes",
        field: "title",
      },
      {
        after:
          "Queensland proposes lifting Bowen Hills height limits from 30 to 50 storeys, adding capacity for up to 4,000 homes within a projected total of 27,000 across the PDA's lifetime. Consultation closes on 9 October 2026. These are proposed planning changes, not completed rezoning or home delivery.",
        before:
          "In October 2025 , the state officially amended and implemented another inner-city PDA in Woolloongabba, which is expected to fast-track more than 16,000 new homes. The scheme also enables the development of key infrastructure projects, including a new indoor sports stadium, planning for the future of the Gabba Stadium and the retention of East Brisbane State School.",
        field: "summary",
      },
      {
        after:
          "Bowen Hills' proposed height increase remains under consultation. Planning capacity is not a delivery timetable.",
        before:
          "Brisbane's Bowen Hills just had its height limit lifted from 30 to 50 storeys, and consultation closes October 9, 2026.",
        field: "sayThis",
      },
      {
        after: null,
        before:
          "Buying: More supply near the CBD means less heat in that pocket, but only once approvals convert to completions years from now.\nHolding: If you own in Bowen Hills, a 50-storey height limit reshapes the precinct's character and your future neighbours before it reshapes your price.\nWatching: The Woolloongabba PDA logged a 466% rise in housing development applications in roughly 12 months after its October 2025 amendment, which is the number to track here.",
        field: "partnerTag",
      },
    ],
  },
  {
    id: 3960017,
    sourceUrl:
      "https://www.realestate.com.au/news/latest-migration-figures-will-have-deep-impact-on-home-prices-rents/",
    reviewSourceUrl:
      "https://www.abs.gov.au/media-centre/media-releases/australias-population-grows-14-march-2026",
    issuedOn: "2026-09-17",
    reference: "Story 3960017",
    what: "The summary foregrounded older suburb analysis rather than the new national release. The counterpoint equated slower price growth with a capital loss.",
    now: "The website leads with the year-to-March national population and migration figures and distinguishes the older observational analysis from established causal effects.",
    fields: [
      {
        field: "summary",
        before:
          "It comes as analysis of ABS data for the 2024/25 financial year, the latest with available suburb-level data, showed areas where migration intake dropped the most over the year had the slowest growing unit prices and rents in their cities.",
        after:
          "ABS figures show Australia’s population grew 1.4% to 27.9 million in the year to March 2026. Net overseas migration contributed 292,100 people, down from 309,500 a year earlier. The accompanying suburb analysis uses older 2024–25 data.",
      },
      {
        field: "sayThis",
        before:
          "Migration relief on rents is real, but the data says it takes 12 to 15 months to show up, and most of the cut has already happened.",
        after:
          "Net overseas migration slowed to 292,100 in the year to March 2026. The separate suburb analysis reports an association with price and rent growth, not a guaranteed rental-relief timetable.",
      },
      {
        field: "counterpoint",
        before:
          "The same analysis shows migration cuts correlate with slower unit price growth, which is rent relief for tenants but a capital loss for landlords already holding in those suburbs.",
        after:
          "Slower price growth is not the same as a capital loss. The suburb analysis is observational and does not establish that migration changes alone caused local price or rent movements.",
      },
    ],
  },
  {
    id: 3960020,
    sourceUrl:
      "https://www.aljazeera.com/news/2026/9/16/what-to-know-about-us-federal-reserves-first-interest-rate-hike-in-3-years",
    issuedOn: "2026-09-17",
    reference: "Story 3960020",
    what: "The same Al Jazeera article appeared in both Global and Business because a tracking parameter produced separate URL identities.",
    now: "The later duplicate is withdrawn from public feeds. Story 3960010 remains available; both database records and any reader notes are retained.",
    fields: [
      {
        field: "channel",
        before: "BUSINESS",
        after: "HOLD",
      },
    ],
  },
  {
    id: 3960056,
    sourceUrl:
      "https://www.nsw.gov.au/ministerial-releases/nsw-government-to-double-length-of-aquaculture-leases-driving-regional-growth",
    issuedOn: "2026-09-17",
    reference: "Story 3960056",
    what: "An expanded government discovery route admitted a release whose main subject was outside the property briefing.",
    now: "The release is withdrawn from public feeds. Government-source selection now requires a housing or planning subject in the opening reporting, and excludes awards and animal rehoming. The database record and reader notes are retained.",
    fields: [
      {
        field: "channel",
        before: "AU",
        after: "HOLD",
      },
    ],
  },
  {
    id: 3960057,
    sourceUrl: "https://statements.qld.gov.au/statements/106056",
    issuedOn: "2026-09-17",
    reference: "Story 3960057",
    what: "An expanded government discovery route admitted a release whose main subject was outside the property briefing.",
    now: "The release is withdrawn from public feeds. Government-source selection now requires a housing or planning subject in the opening reporting, and excludes awards and animal rehoming. The database record and reader notes are retained.",
    fields: [
      {
        field: "channel",
        before: "AU",
        after: "HOLD",
      },
    ],
  },
  {
    id: 3960059,
    sourceUrl:
      "https://www.nsw.gov.au/ministerial-releases/new-14-million-partnership-to-boost-drought-resilience-australian-cropping-systems",
    issuedOn: "2026-09-17",
    reference: "Story 3960059",
    what: "An expanded government discovery route admitted a release whose main subject was outside the property briefing.",
    now: "The release is withdrawn from public feeds. Government-source selection now requires a housing or planning subject in the opening reporting, and excludes awards and animal rehoming. The database record and reader notes are retained.",
    fields: [
      {
        field: "channel",
        before: "AU",
        after: "HOLD",
      },
    ],
  },
  {
    id: 3960060,
    sourceUrl:
      "https://www.nsw.gov.au/ministerial-releases/nsw-winners-announced-at-2026-resilient-australia-awards-0",
    issuedOn: "2026-09-17",
    reference: "Story 3960060",
    what: "An expanded government discovery route admitted a release whose main subject was outside the property briefing.",
    now: "The release is withdrawn from public feeds. Government-source selection now requires a housing or planning subject in the opening reporting, and excludes awards and animal rehoming. The database record and reader notes are retained.",
    fields: [
      {
        field: "channel",
        before: "PROPERTY",
        after: "HOLD",
      },
    ],
  },
  {
    id: 3960061,
    sourceUrl:
      "https://www.nsw.gov.au/ministerial-releases/companion-animal-welfare-program-reopens",
    issuedOn: "2026-09-17",
    reference: "Story 3960061",
    what: "An expanded government discovery route admitted a release whose main subject was outside the property briefing.",
    now: "The release is withdrawn from public feeds. Government-source selection now requires a housing or planning subject in the opening reporting, and excludes awards and animal rehoming. The database record and reader notes are retained.",
    fields: [
      {
        field: "channel",
        before: "PROPERTY",
        after: "HOLD",
      },
    ],
  },
  {
    id: 3960062,
    sourceUrl: "https://www.nsw.gov.au/ministerial-releases/town-hall-square",
    issuedOn: "2026-09-17",
    reference: "Story 3960062",
    what: "The extracted statement was clipped, and commentary assigned the minister’s decision to the advisory commission and suggested an unverified faster approval pathway.",
    now: "The website distinguishes the pause from rejection and the IPC’s advice from the minister’s decision. The claimed faster pathway is withdrawn. Previously distributed copies are not rewritten.",
    fields: [
      {
        field: "summary",
        before:
          "The NSW Minister for Planning and Public Spaces stated: I have today issued a direction under Section 9.1 of the Environmental Planning & Assessment Act 1979 to the City of Sydney Council to prevent determination of any development applications for its Town Hall Square proposal until I receive and make public advice on its State Significance from the Independent Planning...",
        after:
          "NSW has directed City of Sydney Council to pause determination of development applications for Town Hall Square until the planning minister receives and publishes advice from the Independent Planning Commission. This delays determination while state significance is considered; it does not reject the proposal.",
      },
      {
        field: "sayThis",
        before:
          "The NSW planning minister has frozen the City of Sydney's $150 million Town Hall Square proposal, and the IPC now decides whether it becomes a state matter.",
        after:
          "The NSW planning minister has paused determination of Town Hall Square applications pending IPC advice. The minister will decide whether the proposal is State Significant Development.",
      },
      {
        field: "counterpoint",
        before:
          "A State Significant Development declaration could actually accelerate the project by bypassing council entirely and placing approval with a faster state pathway.",
        after: null,
      },
      {
        field: "partnerTag",
        before:
          "Buying: A CBD project of this scale being paused signals that state oversight of major council developments is tightening, not loosening.\nHolding: Commercial CBD assets near the proposed site face prolonged uncertainty while state significance is assessed, with no deadline set for the IPC's advice.\nWatching: The minister's move is a signal that large council-led redevelopments can be stopped mid-process, worth tracking as a precedent for other sites.",
        after: null,
      },
      {
        field: "whyItMatters",
        before:
          "Seven CBD buildings and $150 million in ratepayer funds are now on hold pending IPC advice, with no stated timeline for when that advice will be delivered.",
        after:
          "The proposal involves demolition of seven CBD buildings and at least $150 million in ratepayer funds. Determination is paused while the minister obtains and publishes IPC advice; the release does not establish an approval timetable.",
      },
    ],
  },
  {
    id: 3960033,
    sourceUrl:
      "https://www.mpamag.com/au/news/general/home-resale-profits-ease-as-housing-downturn-takes-hold/590058",
    issuedOn: "2026-09-17",
    reference: "Story 3960033",
    what: "Commentary used profitable sellers’ holding periods to infer that most loss-making sales were short holds, and asserted a Sydney trend and future spread of losses beyond the cited observations.",
    now: "The website reports separate median holding periods of 9.1 years for profitable resales and 8.1 years for loss-making resales, and withdraws unsupported trend and causal interpretations. Previously distributed copies are not rewritten.",
    fields: [
      {
        field: "counterpoint",
        before:
          "Profitable resales were held a median 9.1 years, which means most of the loss-making sales reflect short holds, not broad market destruction.",
        after:
          "Profitable resales were held for a median 9.1 years, compared with 8.1 years for loss-making resales. Those separate medians do not establish that most losses resulted from short holds.",
      },
      {
        field: "sayThis",
        before:
          "95.4% of resales still made money in June, but Melbourne unit sellers lost at a 20.8% rate and Sydney is catching up fast.",
        after:
          "In the June quarter, 95.4% of resales delivered a nominal profit. Melbourne recorded a 20.8% loss rate on unit resales.",
      },
      {
        field: "whyItMatters",
        before:
          "Melbourne's 20.8% unit loss rate and a four-week clearance average of 49.5% at end of August suggest resale pain has further to spread before stabilising.",
        after:
          "National resale profitability and Melbourne unit losses describe different groups. The figures help locate recorded losses; they do not establish where losses will spread next.",
      },
      {
        field: "partnerTag",
        before:
          "Buying: Melbourne and Sydney units are where losses are concentrated, which tells you something real about where negotiating power has shifted.\nHolding: Your equity buffer from recent years is doing work right now, but a 3.7% three-month fall in the combined capitals is eroding it.\nWatching: Auction clearance rates held below 50% since early June, with Brisbane at 32.8%, the weakest signal to confirm before calling a floor.",
        after: null,
      },
    ],
  },
  {
    id: 3960058,
    sourceUrl:
      "https://www.commbank.com.au/articles/newsroom/2026/09/stand-ready-more-interest-rate-rises-imf.html",
    issuedOn: "2026-09-17",
    reference: "Story 3960058",
    what: "Commentary treated structural reform as a prerequisite for rate relief and omitted the inflation condition attached to possible rate cuts.",
    now: "The website preserves both growth and inflation conditions and distinguishes conditional monetary-policy guidance from longer-term reform recommendations. Previously distributed copies are not rewritten.",
    fields: [
      {
        field: "summary",
        before:
          "A global financial body has given the green light to the Reserve Bank to further increase interest rates as inflation strains Australia's economy. Returning inflation to target in the near term should be top priority, the International Monetary Fund said in its latest check-up of the nation's economy on Thursday.",
        after:
          "The IMF says the RBA should be ready to raise rates if needed to control inflation. It also says cuts should be considered if growth slows sharply and inflation appears to be coming under control. Its productivity and tax-reform recommendations are separate from that conditional rate guidance.",
      },
      {
        field: "whyItMatters",
        before:
          "The IMF's explicit endorsement of further RBA tightening, tied to four years of falling productivity, means rate relief depends on structural reform, not just monthly CPI readings.",
        after:
          "The guidance leaves the rate response conditional on inflation and growth. Longer-term productivity reforms are recommended, but the report does not make those reforms a prerequisite for rate cuts.",
      },
      {
        field: "counterpoint",
        before:
          "The IMF also said rate cuts should be considered if growth slows sharply, which means the hiking bias and the easing bias are living in the same document.",
        after:
          "The IMF also says rate cuts should be considered if growth slows sharply, but only if inflation looks to be coming under control.",
      },
      {
        field: "partnerTag",
        before:
          "Buying: Borrowing power stays under pressure while the RBA holds a live hiking bias, regardless of when cuts are eventually priced in.\nHolding: Another rate rise would lift variable repayments again, and the IMF sees energy-driven second-round inflation as a genuine risk.\nWatching: The signal to watch is whether July's hotter inflation print becomes a trend; that is what would tip the RBA's hand.",
        after: null,
      },
    ],
  },
] as const;
