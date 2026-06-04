/**
 * Daily feed seed data. Three days of items so the date picker has chips,
 * each tagged with the 4-persona partnerTag block.
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

function partnerTag(parts: {
  inst: string;
  broker: string;
  adviser: string;
  ba: string;
}): string {
  return [
    `Institutional: ${parts.inst}`,
    `Broker: ${parts.broker}`,
    `Adviser: ${parts.adviser}`,
    `Buyers Agent: ${parts.ba}`,
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
        "The decision was the easy part. Watch broker channel share through June, that's where the real action is.",
      partnerTag: partnerTag({
        inst: "Use the language softening as the trigger for an end-of-year wellbeing-program rate review.",
        broker: "Conversation pivots to fixed-rate roll-offs landing in mid-June, not the cash rate itself.",
        adviser: "Refresh the 'rates higher for longer' framing, the patient line gives clients permission to plan.",
        ba: "Sentiment shifts before listings do. Expect more pre-auction offers in the next four weeks.",
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
        inst: "Soft policy signal. Employer-side conversations are unaffected this cycle.",
        broker: "Anyone selling 'serviceability is loosening' to clients today is selling timing they can't deliver.",
        adviser: "Direction softer, but client borrowing capacity won't change until late Q3 at earliest.",
        ba: "The paper does not change today's deal. It changes the framing of conversations in November.",
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
        "Capacity at mid-tier BAs is the constraint, not demand. Three Melbourne agencies paused intake this week.",
      partnerTag: partnerTag({
        inst: "Property-confidence story for employer wellness conversations on home-deposit support.",
        broker: "Pre-approval lead time is the new constraint. Tighten your pipeline.",
        adviser: "Investor activity ticking up, re-engage clients sitting on deposit cash.",
        ba: "Capacity is the bigger conversation than price. If a mid-tier paused intake, that's where their referrals sit.",
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
        inst: "Salary-packaging clients with energy components should review settings before October.",
        broker: "Rent inflation cooling helps serviceability narrative without the regulator moving.",
        adviser: "Use the composition, not the headline, when framing rates outlook for clients.",
        ba: "Tenant negotiation leverage tilts slightly back to landlords in markets where rents have plateaued.",
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
      sayThis:
        "If a client is in the SMSF property pipeline, lock the indicative this fortnight.",
      partnerTag: partnerTag({
        inst: "Wellbeing program conversations on SMSF strategy gain a fresh hook.",
        broker: "SMSF-specialist accreditation just got more valuable. Check your aggregator's training.",
        adviser: "Material change for clients running property SMSFs. Worth a proactive call.",
        ba: "Reach out to your SMSF-specialist referrers, pipelines reopen on rate moves.",
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
      sayThis:
        "Composition matters. The beat came from where the RBA wants cooling.",
      partnerTag: partnerTag({
        inst: "Wage pressure persists in services. HR-side conversations should price for it.",
        broker: "Borrowing capacity narrative holds; nominal incomes still trending up.",
        adviser: "The 'patience' line gets tested. Don't promise client outlooks the RBA hasn't committed to.",
        ba: "Buyer income growth in services-heavy postcodes still firm, keep them in the pipeline.",
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
      sayThis:
        "Demand is fine. Capacity at the mid-tier is the constraint.",
      partnerTag: partnerTag({
        inst: "Employer-program partners may face wait-list friction with smaller BAs.",
        broker: "Refer clients to BAs with structured intake, pause patterns are spreading.",
        adviser: "If your preferred BA paused intake, line up a backup before client requests stack.",
        ba: "If a competitor just paused, that's where referrals are sitting. Pick up the phone.",
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
      sayThis:
        "The change is small but shows up in 8-year IRRs. Model it for clients who hold long.",
      partnerTag: partnerTag({
        inst: "Employee equity-vs-property comparison frameworks need a refresh.",
        broker: "Investor borrowers holding 8+ years need to know. Lead the conversation.",
        adviser: "Refresh held-property IRR models. The change matters at year eight, not year one.",
        ba: "Long-hold investors are the most affected. Open with this before they ask.",
      }),
    }),
    make({
      feedDate: twoAgo,
      title: "Major bank pilots AI underwriting on broker submissions",
      source: "Banking Day",
      sourceUrl: "https://example.com/ai-underwriting",
      summary:
        "Second cohort widens the pilot. Brokers report faster turnarounds on edge cases.",
      category: "AI",
      sayThis:
        "Speed gains are real. Edge cases now get AI-first review, human second.",
      partnerTag: partnerTag({
        inst: "Faster credit decisions could compress employer payroll-to-settlement timelines.",
        broker: "Edge-case files get a faster yes (or no). Adjust your pipeline assumptions.",
        adviser: "Bank decisioning is changing. The 'always a queue' framing is out of date.",
        ba: "Pre-approval velocity is the new battleground. Brokers with this lender are quicker.",
      }),
    }),
  ];
}
