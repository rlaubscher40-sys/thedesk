/**
 * Edition for 15 May 2026.
 *
 * Drives the Today page end-to-end, stories, reader angles per position,
 * right-rail metrics + topics + ticker. Adjust freely; the UI walks these
 * arrays without any further JSX changes.
 */

// ─── Shared types ───────────────────────────────────────────────────────────

/**
 * Where a reader stands in relation to the market, which is what changes
 * what a story means to them. Canonical keys are single bare words because
 * they are line prefixes in stored text; `personaDisplayLabel` expands them
 * to "If you're buying" and so on for the reader.
 */
export type Persona = "Buying" | "Holding" | "Watching";

export const PERSONAS: Persona[] = ["Buying", "Holding", "Watching"];

type Category =
  | "MACRO"
  | "GEOPOLITICS"
  | "PROPERTY"
  | "AI"
  | "MARKETS"
  | "CLIMATE"
  | "SPORT"
  | "CULTURE"
  | "REDDIT"
  | "CRYPTO";

type PartnerAngle = {
  persona: Persona;
  /** One-sentence "why this matters" angle for this persona. */
  angle: string;
  /** Persona-specific Say This line. Copyable, logs to tracker on copy. */
  sayThis: string;
};

export type Story = {
  id: string;
  category: Category;
  /** Where the headline lives in the layout hierarchy. */
  section: "featured" | "more" | "further";
  source: string;
  sourceUrl: string;
  /** Optional favicon URL, we fall back to a category-coloured glyph. */
  sourceFavicon?: string;
  /** Optional thumbnail for "more from today" cards. */
  thumbnail?: string;
  headline: string;
  /** 2-4 sentence editorial dek. */
  dek: string;
  /** Role-keyed angles + Say This lines. Always exactly three entries. */
  partnerAngles: PartnerAngle[];
  /** Optional analyst note, rendered behind the "Show context" expander. */
  context?: string;
  /** "5 min" style reading-time chip on Featured cards. */
  readingTime?: string;
  /** Optional subscription tier gate. "paid" stories render a soft
   *  paywall hint that drives users to subscribe. */
  tier?: "free" | "paid";
};

// ─── The edition ────────────────────────────────────────────────────────────

export const editionMeta = {
  number: 1010,
  date: "2026-05-15",
  weekday: "FRIDAY",
  /** "FRIDAY 15 MAY 2026", pre-formatted for the hero pill. */
  longDate: "FRIDAY 15 MAY 2026",
  weekRange: "12-18 May 2026",
  publishedAt: "07:00 AEST",
};

export const stories: Story[] = [
  // ── FEATURED ─────────────────────────────────────────────────────────────
  {
    id: "rba-hold",
    section: "featured",
    category: "MACRO",
    source: "AFR",
    sourceUrl: "https://example.com/rba-may-decision",
    headline: "RBA holds at 4.35%, language softens on services inflation",
    readingTime: "3 min",
    dek: "The Reserve Bank held the cash rate, with the post-meeting statement removing the 'further tightening cannot be ruled out' line. Markets read a dovish shift, swaps repricing for a first cut in November. Governor's press conference repeated 'patient transmission' three times, the Bank is signalling that the lag from prior tightening is still working.",
    context:
      "Two readings of the statement matter: (1) the dropped sentence on further tightening is the dovish read the bond market has run with; (2) the 'patient transmission' line is the new conditional for a November cut. Watch the next monthly CPI on May 28, if services inflation prints below 4.5% YoY, swaps will price in a cut at the next meeting, not November. The story this week is not the hold itself; it's what happens to fixed-rate roll-off volumes in mid-June.",
    partnerAngles: [
      {
        persona: "Buying",
        angle: "Your borrowing capacity is unchanged, but competition rises before listings do.",
        sayThis:
          "A hold does not move auctions on the weekend. It moves the offers people make on Wednesday afternoon.",
      },
      {
        persona: "Holding",
        angle:
          "The fixed-rate roll-offs landing in mid-June matter more to you than the decision did.",
        sayThis:
          "The decision was the easy part. What happens to fixed-rate roll-offs in four weeks is the real story.",
      },
      {
        persona: "Watching",
        angle:
          "Patient transmission is the condition for a November cut. The next CPI is the test.",
        sayThis:
          "If you have been waiting for clarity on rates, this is the closest thing to it. The path is patience.",
      },
    ],
  },

  // ── MORE FROM TODAY ─────────────────────────────────────────────────────
  {
    id: "apra-buffer",
    section: "more",
    category: "MACRO",
    source: "Banking Day",
    sourceUrl: "https://example.com/apra-buffer",
    thumbnail: "apra",
    headline: "APRA opens consultation on the 3% serviceability buffer",
    dek: "The regulator opened a consultation paper hinting at a possible buffer review, while committing to nothing specific. Submissions close June 20.",
    context:
      "Don't sell timing you can't deliver. The earliest a revised regime could land is late Q3. The signal in the paper is direction, not timing, APRA wants the option to ease without committing to it.",
    partnerAngles: [
      {
        persona: "Buying",
        angle:
          "Nothing you can borrow today changes. Anyone telling you otherwise is selling timing.",
        sayThis: "Today's deal does not move on this. November's might.",
      },
      {
        persona: "Holding",
        angle:
          "No effect on an existing loan. It matters if you plan to borrow again late this year.",
        sayThis:
          "Read the consultation, not the headlines about it. November is the earliest anything shifts.",
      },
      {
        persona: "Watching",
        angle: "Direction is softer, but capacity will not move until Q4 at the earliest.",
        sayThis:
          "The buffer stands as it is. Plan around that, not around the direction of travel.",
      },
    ],
  },
  {
    id: "sydney-auctions",
    section: "more",
    category: "PROPERTY",
    source: "CoreLogic",
    sourceUrl: "https://example.com/corelogic-may",
    thumbnail: "auctions",
    headline: "Sydney auction clearance hits 67.4% as listings rise 18% YoY",
    dek: "Sixth consecutive week above 65%. Volume is finally catching up with the price story. Under-$1.5m segment is doing most of the work; prestige still patient.",
    context:
      "The headline number matters less than the spread. Inner-ring clearance is at 71%, outer-ring is at 58%. The gap is the widest it's been since early 2024. Buyers are paying for geography again.",
    partnerAngles: [
      {
        persona: "Buying",
        angle:
          "Approval lead times are now running longer than auction calendars. Get pre-approved first.",
        sayThis:
          "The constraint is not finding a property. It is being ready to bid on the one you find.",
      },
      {
        persona: "Holding",
        angle:
          "Listings up 18% with clearance holding is a market absorbing supply, not one turning.",
        sayThis:
          "Rising listings and steady clearance is strength, not weakness. Read them together.",
      },
      {
        persona: "Watching",
        angle: "Six weeks above 65% is a trend. One weekend is not.",
        sayThis: "Cash on the sidelines cost more this month than it did last month.",
      },
    ],
  },
  {
    id: "energy-cpi",
    section: "more",
    category: "MACRO",
    source: "ABS",
    sourceUrl: "https://example.com/abs-cpi",
    thumbnail: "energy",
    headline: "Energy bills lift the monthly CPI to 3.4% YoY",
    dek: "Electricity contributed a quarter of the headline print on the July reset. Housing-related inflation softer than expected.",
    context:
      "The energy reset rolls off the year-on-year base in October. Watch the Q3 monthly CPI, if the underlying trend has held, headline drops sharply and the RBA's path looks clearer.",
    partnerAngles: [
      {
        persona: "Buying",
        angle:
          "Rents are softer than the headline suggests, which quietly helps what you can borrow.",
        sayThis: "The headline number is energy. The part that affects your borrowing is cooling.",
      },
      {
        persona: "Holding",
        angle: "Where rents have plateaued, bargaining power swings back towards the landlord.",
        sayThis:
          "Rent inflation cooling is not the same as rents falling. Check which one your market is doing.",
      },
      {
        persona: "Watching",
        angle: "It is the composition of this print that matters now, not the headline.",
        sayThis: "Energy lifted the number. Strip it out and the trend is the other way.",
      },
    ],
  },
  {
    id: "imf-iran",
    section: "more",
    category: "GEOPOLITICS",
    source: "Reuters",
    sourceUrl: "https://example.com/imf-iran",
    thumbnail: "imf",
    headline: "IMF flags Iran sanctions risk to global oil supply",
    dek: "The Fund's latest staff paper raises the probability-weighted oil shock scenario by 8 percentage points. Brent crude swap curves steepening.",
    context:
      "The IMF rarely commits a probability to a geopolitical scenario. When they do, central banks read it carefully. A 100bp move in the oil curve translates roughly to 30bp on Australian headline CPI within two quarters.",
    partnerAngles: [
      {
        persona: "Buying",
        angle:
          "Fuel feeds living-expense schedules, which is where a sustained oil move reaches your application.",
        sayThis:
          "Living-expense assumptions are about to look different. Time an application around it.",
      },
      {
        persona: "Holding",
        angle: "Outer-ring commuter suburbs are the most fuel-sensitive holdings you can own.",
        sayThis: "Commuter postcodes feel a sustained oil move before anywhere else does.",
      },
      {
        persona: "Watching",
        angle: "The IMF does not put a number on a tail risk lightly.",
        sayThis: "This is a tail risk with a figure attached now. That is the part worth noticing.",
      },
    ],
  },
  {
    id: "us-china",
    section: "more",
    category: "GEOPOLITICS",
    source: "FT",
    sourceUrl: "https://example.com/us-china",
    thumbnail: "uschina",
    headline: "US and China reopen working group on semiconductor export controls",
    dek: "First face-to-face since November. Both sides briefed expectations down ahead of the meeting; markets price a narrow positive surprise.",
    context:
      "Reopening the working group is procedure, not breakthrough. The signal is in what the joint statement chooses to omit, not what it includes. Look for whether 'national security' caveats remain or are softened.",
    partnerAngles: [
      {
        persona: "Buying",
        angle:
          "Indirect, but Sydney's tech-corridor postcodes track this more closely than you would expect.",
        sayThis: "Sydney's tech-corridor markets are tied to this. Quietly.",
      },
      {
        persona: "Holding",
        angle: "Sentiment in tech employment reaches those same suburbs about two weeks later.",
        sayThis: "Employment sentiment leads housing demand in the corridors that depend on it.",
      },
      {
        persona: "Watching",
        angle: "The signal is in what the joint statement omits, not what it includes.",
        sayThis: "Geopolitics has driven the correlation all year. Read the omissions.",
      },
    ],
  },

  // ── FURTHER SIGNALS ─────────────────────────────────────────────────────
  {
    id: "budget-tax",
    section: "further",
    category: "MACRO",
    source: "Treasury",
    sourceUrl: "https://example.com/budget",
    tier: "paid",
    headline: "Federal Budget: CGT discount tweak on long-held investment property",
    dek: "Two paragraphs on page 147 adjust the discount rate for properties held over 8 years. The IRR maths shifts at year eight. Morning coverage missed it entirely.",
    partnerAngles: [
      {
        persona: "Buying",
        angle: "Nothing changes in year one. It changes the maths on how long you intend to hold.",
        sayThis: "Buy for a decade and this is your story. Buy for three years and it is not.",
      },
      {
        persona: "Holding",
        angle: "If you are in year seven of an investment property, this lands on you today.",
        sayThis: "Year seven is the one to check. The maths shifts at year eight.",
      },
      {
        persona: "Watching",
        angle: "Two paragraphs on page 147, and the morning coverage missed them entirely.",
        sayThis: "The change that matters was on page 147, not in the speech.",
      },
    ],
  },
  {
    id: "tsmc-fab",
    section: "further",
    category: "AI",
    source: "Bloomberg",
    sourceUrl: "https://example.com/tsmc",
    tier: "paid",
    headline: "TSMC pulls forward Arizona fab phase three by nine months",
    dek: "Onshoring acceleration: $4B incremental capex, first wafers Q4 2027 instead of Q3 2028. Reaction in TWD muted; reaction in AUD-AUD swap spreads telling.",
    partnerAngles: [
      {
        persona: "Buying",
        angle: "No direct read for a purchase. Worth knowing as background on the rates path.",
        sayThis: "Not a property story. It is a rates story wearing a semiconductor costume.",
      },
      {
        persona: "Holding",
        angle: "A quiet positive for anyone whose income depends on the tech sector.",
        sayThis: "Onshoring news like this is a slow tailwind, not an event.",
      },
      {
        persona: "Watching",
        angle:
          "The muted reaction in TWD and the move in AUD swap spreads is the interesting part.",
        sayThis: "The currency barely moved. The swap spreads did. That is the tell.",
      },
    ],
  },

  // ── Trending / Culture, broadly relevant items that DON'T deserve
  // a forced angle for every reader position. These demonstrate the
  // filtering: if the reader's own position has no angle, the
  // card shows a quiet "Not relevant to X this week" note instead of
  // a fabricated talking point.
  {
    id: "wwc-heat",
    section: "further",
    category: "SPORT",
    source: "Yahoo Sports",
    sourceUrl: "https://example.com/wwc-heat",
    headline: "World Weather Attribution warns FIFA on extreme-heat match conditions",
    dek: "Roughly a quarter of expanded 2026 men's World Cup fixtures forecast to play in conditions exceeding FIFPRO safety limits. Five matches flagged where postponement would be advised.",
    partnerAngles: [],
  },
  {
    id: "x-trends",
    section: "further",
    category: "CULTURE",
    source: "Visible · X",
    sourceUrl: "https://example.com/x-trends",
    headline: "X worldwide trends dominated by entertainment and fandom signals",
    dek: "Top of the visible archive: TLEFIRSTONE X KAZZ 2026, PPP FAMILY KAZZAWARDS, #HEESEUNG, #OLYMPOP2026DAY. Cultural and sport tags eclipse the macro feed.",
    partnerAngles: [],
  },
  {
    id: "reddit-sentiment",
    section: "further",
    category: "REDDIT",
    source: "r/AusFinance",
    sourceUrl: "https://example.com/reddit-ausfinance",
    headline: "AusFinance pivots: 'rates higher for longer' fading from the top of the sub",
    dek: "Sentiment shift on the largest Australian finance subreddit, top-three threads this week are now about fixed-rate roll-off strategy, not the cash rate path. Anecdotal but directional.",
    partnerAngles: [
      {
        persona: "Holding",
        angle:
          "The sub has moved from the cash rate to fixed-rate roll-off strategy. So should you.",
        sayThis:
          "AusFinance stopped arguing about the cash rate and started planning roll-offs. That shift usually leads the market by a fortnight.",
      },
    ],
  },
];
