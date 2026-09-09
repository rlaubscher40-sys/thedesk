/**
 * Daily feed seed data. Three days of items so the date picker has chips,
 * each tagged with the 3-role partnerTag block.
 */
import type { DailyFeedItem } from "../db/schema";

/** "YYYY-MM-DD" in Sydney tz for `offset` days ago. */
function isoDate(offset: number): string {
  const d = new Date(Date.now() - offset * 86400000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${day}`;
}

function partnerTag(parts: { buying: string; holding: string; watching: string }): string {
  return [
    `Buying: ${parts.buying}`,
    `Holding: ${parts.holding}`,
    `Watching: ${parts.watching}`,
  ].join("\n");
}

export function feedSeed(): DailyFeedItem[] {
  const today = isoDate(0);
  const yesterday = isoDate(1);
  const twoAgo = isoDate(2);

  let id = 1;
  const make = (
    item: Omit<
      DailyFeedItem,
      | "sourceTiming"
      | "id"
      | "createdAt"
      | "promotedToEdition"
      | "imageUrl"
      | "rubensNote"
      | "whyItMatters"
      | "priority"
      | "counterpoint"
      | "corroborationCount"
      | "corroboratingSources"
      | "threadParentId"
      | "threadParentTitle"
      | "channel"
    > & {
      imageUrl?: string | null;
      rubensNote?: string | null;
      whyItMatters?: string | null;
      priority?: number;
      counterpoint?: string | null;
      corroborationCount?: number;
      corroboratingSources?: string[] | null;
      threadParentId?: number | null;
      threadParentTitle?: string | null;
      /** Content lane. Defaults to AU so only the PROPERTY / coverage items
       *  need to opt in. */
      channel?: string;
    }
  ): DailyFeedItem => ({
    sourceTiming: null,
    id: id++,
    promotedToEdition: false,
    rubensNote: item.rubensNote ?? null,
    whyItMatters: item.whyItMatters ?? null,
    priority: item.priority ?? 50,
    counterpoint: item.counterpoint ?? null,
    corroborationCount: item.corroborationCount ?? 1,
    corroboratingSources: item.corroboratingSources ?? null,
    threadParentId: item.threadParentId ?? null,
    threadParentTitle: item.threadParentTitle ?? null,
    createdAt: new Date(Date.now() - id * 1000 * 60 * 17),
    ...item,
    imageUrl: item.imageUrl ?? null,
    channel: item.channel ?? "AU",
  });

  return [
    // ── Today ─────────────────────────────────────────────────────────
    make({
      feedDate: today,
      title: "RBA holds at 4.35% as expected, language softens on services inflation",
      source: "AFR",
      sourceUrl: "https://example.com/rba-may-decision",
      summary:
        "The Reserve Bank held the cash rate, with the post-meeting statement removing the 'further tightening cannot be ruled out' line. Markets read a dovish shift, swaps repricing for a first cut in November.",
      category: "MACRO",
      whyItMatters:
        "Dropping the tightening-bias line is the clearest signal yet that the cash rate has peaked, watch swaps pricing and fixed-rate roll-offs over June for the first real demand response.",
      sayThis:
        "The decision was the easy part. What happens to fixed-rate roll-offs in June is the real story.",
      partnerTag: partnerTag({
        buying: "What you can borrow holds steady, but competition builds before listings do.",
        holding:
          "Nothing moves on your repayments until the fixed-rate roll-offs land in mid-June.",
        watching:
          "Patient transmission is the condition for a November cut. The next CPI is the test.",
      }),
    }),
    make({
      feedDate: today,
      title: "APRA proposes serviceability buffer review in consultation paper",
      source: "Banking Day",
      sourceUrl: "https://example.com/apra-buffer",
      summary:
        "The regulator opened a consultation on the 3% buffer, hinting at a possible review but committing to nothing. Submissions close June 20.",
      category: "POLICY",
      sayThis:
        "Read the paper, not the headlines about it. The buffer review is a Q4 story at the earliest.",
      partnerTag: partnerTag({
        buying: "Nothing you can borrow today changes. Anyone saying otherwise is selling timing.",
        holding:
          "No effect on an existing loan. It matters only if you borrow again late this year.",
        watching: "Direction is softer, but capacity will not move until Q4 at the earliest.",
      }),
    }),
    make({
      feedDate: today,
      title: "Sydney auction clearance hits 67.4% as listings rise 18% YoY",
      source: "CoreLogic",
      sourceUrl: "https://example.com/corelogic-may",
      summary:
        "Sixth consecutive week above 65%. Volume is catching up with the price story; the under-$1.5m segment is doing most of the work.",
      category: "PROPERTY",
      channel: "PROPERTY",
      sayThis:
        "Three Melbourne buyer agencies closed intake this week. Agencies do that when demand outruns them.",
      partnerTag: partnerTag({
        buying: "Approval lead times now run longer than auction calendars. Be pre-approved first.",
        holding:
          "Listings up 18% with clearance holding is a market absorbing supply, not turning.",
        watching: "Six weeks above 65% is a trend. One weekend is not.",
      }),
    }),
    make({
      feedDate: today,
      title: "Energy bills lift monthly CPI, retail electricity rises 6.1%",
      source: "ABS",
      sourceUrl: "https://example.com/abs-cpi-may",
      summary:
        "Headline 3.4% YoY. Electricity contributed a quarter of the print on the July reset; housing-related inflation softer than expected.",
      category: "ECONOMICS",
      sayThis:
        "The composition matters more than the headline. Energy resets, not rents, are the story.",
      partnerTag: partnerTag({
        buying:
          "Rents are softer than the headline suggests, which quietly helps what you can borrow.",
        holding: "Where rents have plateaued, bargaining power tilts back towards the landlord.",
        watching: "It is the composition of this print that matters now, not the headline number.",
      }),
    }),

    // ── Today · coverage lanes (BUSINESS / TECH / GLOBAL) ───────────────
    // Coverage-only: headline + summary + source, no partner angles / Say
    // This / Why it matters. These populate the non-AU tabs in demo mode and
    // mirror what the live ingest will produce for the unenriched channels.
    make({
      feedDate: today,
      channel: "BUSINESS",
      title: "Wall Street closes higher as megacap tech leads a broad rebound",
      source: "Reuters",
      sourceUrl: "https://example.com/wall-street-rebound",
      summary:
        "The S&P 500 and Nasdaq both finished up more than 1%, with semiconductors and cloud names leading. Traders pointed to softer Treasury yields and an easing in last week's volatility.",
      category: "MARKETS",
      partnerTag: null,
      sayThis: null,
    }),
    make({
      feedDate: today,
      channel: "BUSINESS",
      title: "Fed officials signal patience on the timing of the first rate cut",
      source: "Bloomberg",
      sourceUrl: "https://example.com/fed-patience",
      summary:
        "Two regional Fed presidents said they want several more months of cooling inflation data before easing, pushing market-implied odds of a September move lower.",
      category: "MACRO",
      partnerTag: null,
      sayThis: null,
    }),
    make({
      feedDate: today,
      channel: "BUSINESS",
      title: "Oil slips below US$80 as OPEC+ weighs a gradual output increase",
      source: "Financial Times",
      sourceUrl: "https://example.com/oil-opec",
      summary:
        "Brent crude eased as delegates signalled the group could begin unwinding voluntary cuts later this year, against a backdrop of soft Chinese demand.",
      category: "MARKETS",
      partnerTag: null,
      sayThis: null,
    }),

    // ── Today · Tech & Science ──────────────────────────────────────────
    make({
      feedDate: today,
      channel: "TECH",
      title: "Rival labs race to ship cheaper reasoning models",
      source: "The Verge",
      sourceUrl: "https://example.com/reasoning-models",
      summary:
        "A wave of releases this week undercut the price of frontier-grade reasoning by an order of magnitude, intensifying a margin war among the largest AI providers.",
      category: "AI",
      partnerTag: null,
      sayThis: null,
    }),
    make({
      feedDate: today,
      channel: "TECH",
      title: "Apple previews on-device AI features at its developer conference",
      source: "TechCrunch",
      sourceUrl: "https://example.com/apple-on-device-ai",
      summary:
        "The company leaned on privacy and local processing, positioning its assistant as running on the phone rather than in the cloud for most everyday tasks.",
      category: "TECH",
      partnerTag: null,
      sayThis: null,
    }),
    make({
      feedDate: today,
      channel: "TECH",
      title: "Astronomers confirm water ice in permanently shadowed lunar craters",
      source: "Nature",
      sourceUrl: "https://example.com/lunar-ice",
      summary:
        "New spectrometer data resolves a decade-long debate and bolsters the case for siting a long-term research base near the Moon's south pole.",
      category: "SCIENCE",
      partnerTag: null,
      sayThis: null,
    }),

    // ── Today · Global top stories ──────────────────────────────────────
    make({
      feedDate: today,
      channel: "GLOBAL",
      title: "Negotiators reach a tentative ceasefire framework after marathon talks",
      source: "Associated Press",
      sourceUrl: "https://example.com/ceasefire-framework",
      summary:
        "Mediators announced an outline agreement following overnight sessions, though officials cautioned that several contentious points remain unresolved.",
      category: "GEOPOLITICS",
      partnerTag: null,
      sayThis: null,
    }),
    make({
      feedDate: today,
      channel: "GLOBAL",
      title: "Record heatwave grips southern Europe as power grids strain",
      source: "BBC",
      sourceUrl: "https://example.com/europe-heatwave",
      summary:
        "Temperatures topped 44°C across parts of the Mediterranean, prompting health warnings and a surge in cooling demand that tested ageing transmission networks.",
      category: "OTHER",
      partnerTag: null,
      sayThis: null,
    }),
    make({
      feedDate: today,
      channel: "GLOBAL",
      title: "Japan and South Korea deepen a security-cooperation pact",
      source: "Nikkei",
      sourceUrl: "https://example.com/japan-korea-pact",
      summary:
        "The two governments agreed to expand intelligence sharing and joint exercises, a further thaw in relations watched closely across the region.",
      category: "GEOPOLITICS",
      partnerTag: null,
      sayThis: null,
    }),

    // ── Yesterday ─────────────────────────────────────────────────────
    make({
      feedDate: yesterday,
      title: "CBA cuts SMSF LRBA rates 15 bp, others expected to follow",
      source: "MFAA",
      sourceUrl: "https://example.com/cba-smsf",
      summary:
        "First major to move on SMSF-specific lending in over a year. Likely defensive against rising NAB activity in the segment.",
      category: "MARKETS",
      sayThis: "One lender moving on SMSF rates usually means three more within a month.",
      partnerTag: partnerTag({
        buying: "If you are buying inside super, the cost of that structure just fell.",
        holding: "Worth repricing an existing SMSF loan before the rest of the market follows.",
        watching: "One lender moving on SMSF rates usually means three more within a month.",
      }),
    }),
    make({
      feedDate: yesterday,
      title: "Wage Price Index Q1 firmer than expected, private services drive upside",
      source: "ABS",
      sourceUrl: "https://example.com/wpi-q1",
      summary:
        "3.8% YoY beat consensus 3.6%. Private-sector services up the most, the segment the RBA wants softer.",
      category: "ECONOMICS",
      sayThis: "Composition matters. The beat came from where the RBA wants cooling.",
      partnerTag: partnerTag({
        buying: "Nominal incomes still rising, which holds up what banks will lend you.",
        holding:
          "Firmer wages make an early cut less likely, so plan repayments on the rate you have.",
        watching: "This is the print that tests the RBA's patience line. Watch services wages.",
      }),
    }),
    make({
      feedDate: yesterday,
      title: "Three mid-tier Melbourne buyer agencies close intake quietly",
      source: "REB",
      sourceUrl: "https://example.com/reb-bas",
      summary:
        "None of them announced; one website now reads 'currently servicing existing clients only'. Capacity, not demand.",
      category: "PROPERTY",
      channel: "PROPERTY",
      sayThis: "Demand is fine. Finding someone with capacity to help you buy is the constraint.",
      partnerTag: partnerTag({
        buying:
          "If you were planning to hire help searching, availability just tightened in Melbourne.",
        holding: "Little direct read, though intake pauses tend to track a busier buy side.",
        watching: "Agencies close intake when demand outruns capacity. That is a demand signal.",
      }),
    }),

    // ── Two days ago ──────────────────────────────────────────────────
    make({
      feedDate: twoAgo,
      title: "Federal Budget: CGT discount tweak buried on page 147",
      source: "Treasury",
      sourceUrl: "https://example.com/budget",
      summary:
        "Two paragraphs adjust the discount rate on properties held over 8 years. IRR maths shifts; morning coverage missed it.",
      category: "POLICY",
      sayThis: "Small on paper, and it lands squarely on anyone planning to hold past year eight.",
      partnerTag: partnerTag({
        buying: "Nothing changes in year one. It changes the maths on how long you intend to hold.",
        holding: "If you are in year seven of an investment property, this lands on you today.",
        watching: "Two paragraphs on page 147, and the morning coverage missed them entirely.",
      }),
    }),
    make({
      feedDate: twoAgo,
      title: "Major bank pilots AI underwriting on broker submissions",
      source: "Banking Day",
      sourceUrl: "https://example.com/ai-underwriting",
      summary: "Second cohort widens the pilot. Brokers report faster turnarounds on edge cases.",
      category: "AI",
      sayThis: "An awkward application now gets a faster answer. Not always a kinder one.",
      partnerTag: partnerTag({
        buying: "An awkward application may now get a faster answer, in either direction.",
        holding: "No effect on a loan you already hold, but refinancing may move quicker.",
        watching: "Decision speed is becoming a lender differentiator. Watch who follows.",
      }),
    }),
  ];
}
