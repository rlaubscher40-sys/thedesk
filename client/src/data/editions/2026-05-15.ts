/**
 * Edition for 15 May 2026.
 *
 * Drives the Today page end-to-end — stories, partner angles per persona,
 * right-rail metrics + topics + ticker. Adjust freely; the UI walks these
 * arrays without any further JSX changes.
 */

// ─── Shared types ───────────────────────────────────────────────────────────

export type Persona =
  | "Institutional"
  | "Broker"
  | "Adviser"
  | "Buyers Agent";

export const PERSONAS: Persona[] = ["Institutional", "Broker", "Adviser", "Buyers Agent"];

export type Category =
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

export const FEED_FILTERS: Array<{ id: Category | "ALL"; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "MACRO", label: "Macro" },
  { id: "GEOPOLITICS", label: "Geopolitics" },
  { id: "PROPERTY", label: "Property" },
  { id: "AI", label: "AI" },
  { id: "MARKETS", label: "Markets" },
  { id: "CLIMATE", label: "Climate" },
  { id: "SPORT", label: "Sport, Culture and Entertainment" },
  { id: "REDDIT", label: "Reddit Community Sentiment" },
  { id: "CRYPTO", label: "Crypto" },
];

export type PartnerAngle = {
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
  /** Optional favicon URL — we fall back to a category-coloured glyph. */
  sourceFavicon?: string;
  /** Optional thumbnail for "more from today" cards. */
  thumbnail?: string;
  headline: string;
  /** 2-4 sentence editorial dek. */
  dek: string;
  /** Persona-keyed angles + Say This lines. Always exactly four entries. */
  partnerAngles: PartnerAngle[];
  /** Optional analyst note — rendered behind the "Show context" expander. */
  context?: string;
  /** "5 min" style reading-time chip on Featured cards. */
  readingTime?: string;
  /** Optional subscription tier gate. "paid" stories render a soft
   *  paywall hint that drives users to subscribe. */
  tier?: "free" | "paid";
};

export type Metric = {
  /** Short uppercase key as shown on the right rail tile. */
  key: string;
  /** Single-line value. */
  value: string;
  /** Prior-edition value used to compute the trend arrow. Optional —
   *  if absent, the tile renders without a delta. */
  prior?: string;
  /** Optional supporting line beneath the value. */
  detail?: string;
};

export type Topic = {
  category: Category;
  label: string;
  count: number;
};

export type TickerItem = {
  label: string;
  category?: Category;
};

// ─── The edition ────────────────────────────────────────────────────────────

export const editionMeta = {
  number: 1010,
  date: "2026-05-15",
  weekday: "FRIDAY",
  /** "FRIDAY 15 MAY 2026" — pre-formatted for the hero pill. */
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
    dek: "The Reserve Bank held the cash rate, with the post-meeting statement removing the 'further tightening cannot be ruled out' line. Markets read a dovish shift, swaps repricing for a first cut in November. Governor's press conference repeated 'patient transmission' three times — the Bank is signalling that the lag from prior tightening is still working.",
    context:
      "Two readings of the statement matter: (1) the dropped sentence on further tightening is the dovish read the bond market has run with; (2) the 'patient transmission' line is the new conditional for a November cut. Watch the next monthly CPI on May 28 — if services inflation prints below 4.5% YoY, swaps will price in a cut at the next meeting, not November. The conversation to lead with brokers this week is not about the hold itself; it's about what happens to fixed-rate roll-off volumes in mid-June.",
    partnerAngles: [
      {
        persona: "Institutional",
        angle:
          "Use the language softening as the trigger for a year-end wellbeing-program rate review with corporate clients.",
        sayThis:
          "The RBA dropped 'further tightening' for the first time in 14 months — a quiet but meaningful pivot for any employer running a salary-packaging or financial-wellness program.",
      },
      {
        persona: "Broker",
        angle:
          "Pivot client conversations to fixed-rate roll-offs landing in mid-June, not the cash rate itself.",
        sayThis:
          "The decision was the easy part. Watch what your broker channel does in the four weeks after a hold — that's where the real action is.",
      },
      {
        persona: "Adviser",
        angle:
          "Refresh the 'rates higher for longer' framing — patient transmission gives clients permission to plan.",
        sayThis:
          "If your clients have been waiting for clarity on rates, this is the closest thing they're going to get. The path is patience.",
      },
      {
        persona: "Buyers Agent",
        angle:
          "Sentiment shifts before listings do. Expect more pre-auction offers in the next four weeks.",
        sayThis:
          "Hold decisions don't move auctions on the weekend. They move the offers buyers make on Wednesday afternoon.",
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
      "Don't sell timing you can't deliver. The earliest a revised regime could land is late Q3. The signal in the paper is direction, not timing — APRA wants the option to ease without committing to it.",
    partnerAngles: [
      {
        persona: "Institutional",
        angle: "Soft policy signal. Employer-side conversations are unaffected this cycle.",
        sayThis:
          "The buffer review is a Q4 story at the earliest. Don't let HR-team newsletters get ahead of the regulator.",
      },
      {
        persona: "Broker",
        angle: "Anyone selling 'serviceability is loosening' today is selling timing they can't deliver.",
        sayThis: "Read the paper, not the headlines about the paper. November is the earliest.",
      },
      {
        persona: "Adviser",
        angle: "Direction softer, but client borrowing capacity won't change until late Q3 at earliest.",
        sayThis: "Borrowing capacity won't move until Q4. Plan around the buffer as it stands.",
      },
      {
        persona: "Buyers Agent",
        angle: "The paper does not change today's deal. It changes the framing of conversations in November.",
        sayThis: "Today's deal won't move on this. November's deal might.",
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
        persona: "Institutional",
        angle: "Property-confidence story for employer wellness conversations on home-deposit support.",
        sayThis: "Deposit-support programs land harder when clearances are above 65%. We're there now.",
      },
      {
        persona: "Broker",
        angle: "Pre-approval lead time is the new constraint. Tighten your pipeline.",
        sayThis: "Approvals are taking longer than auction calendars. Your clients need to be pre-approved.",
      },
      {
        persona: "Adviser",
        angle: "Investor activity is ticking up. Re-engage clients sitting on deposit cash.",
        sayThis: "Cash sitting on the sidelines costs more this month than it did last month.",
      },
      {
        persona: "Buyers Agent",
        angle: "Capacity at mid-tier BAs is the constraint, not demand.",
        sayThis: "Three Melbourne BAs paused intake this week. Those referrals are sitting somewhere.",
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
      "The energy reset rolls off the year-on-year base in October. Watch the Q3 monthly CPI — if the underlying trend has held, headline drops sharply and the RBA's path looks clearer.",
    partnerAngles: [
      {
        persona: "Institutional",
        angle: "Salary-packaging clients with energy components should review settings before October.",
        sayThis: "October is when the energy line rolls off the YoY base. Review packaging before then.",
      },
      {
        persona: "Broker",
        angle: "Rent inflation cooling helps the serviceability narrative without the regulator moving.",
        sayThis: "Rents are softer than the headline suggests. That helps borrowing capacity quietly.",
      },
      {
        persona: "Adviser",
        angle: "Use the composition, not the headline, when framing the rates outlook.",
        sayThis: "It's the composition of CPI that matters now, not the headline number.",
      },
      {
        persona: "Buyers Agent",
        angle: "Tenant negotiation leverage tilts slightly back to landlords in markets where rents have plateaued.",
        sayThis: "Where rents have plateaued, leverage swings back to the landlord. Negotiate accordingly.",
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
        persona: "Institutional",
        angle: "Energy-cost pass-through to corporate margins changes the wage-bargaining backdrop.",
        sayThis: "Oil shocks are wage-bargaining stories, not just inflation stories.",
      },
      {
        persona: "Broker",
        angle: "Fuel costs feed into living-expense schedules. Sensitivity matters for marginal applicants.",
        sayThis: "Living-expense schedules are about to look different. Plan applications around it.",
      },
      {
        persona: "Adviser",
        angle: "Defensive allocation conversation. Energy exposure earns its keep when the curve steepens.",
        sayThis: "Energy exposure is a hedge again. The IMF doesn't put a number on a tail risk lightly.",
      },
      {
        persona: "Buyers Agent",
        angle: "Outer-ring commuter postcodes are most fuel-sensitive. Read demand there carefully.",
        sayThis: "Fuel-sensitive commuter postcodes will feel a sustained oil move before anyone else does.",
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
        persona: "Institutional",
        angle: "Tech-procurement risk on long-dated capex. Boards will ask about exposure.",
        sayThis: "Boards are asking about chip exposure again. Be ready to brief.",
      },
      {
        persona: "Broker",
        angle: "Tech-sector clients reading this as a sentiment positive. Refi conversations may pick up.",
        sayThis: "Tech clients watch this closely. Refi appetite tends to follow sentiment by two weeks.",
      },
      {
        persona: "Adviser",
        angle: "Diversification narrative gets harder when geopolitics drives the correlation.",
        sayThis: "Geopolitics has been the correlation driver this year. Diversification needs a rethink.",
      },
      {
        persona: "Buyers Agent",
        angle: "Indirect — but Sydney's tech-corridor postcodes are inversely correlated with chip news.",
        sayThis: "Sydney's tech-corridor markets are tied to this. Quietly.",
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
        persona: "Institutional",
        angle: "Employee equity-vs-property comparison frameworks need a refresh.",
        sayThis: "Equity-vs-property frameworks for senior staff need updating this fortnight.",
      },
      {
        persona: "Broker",
        angle: "Investor borrowers holding 8+ years need to know. Lead the conversation.",
        sayThis: "If a client is in year seven of an investment property, this conversation lands today.",
      },
      {
        persona: "Adviser",
        angle: "Refresh held-property IRR models. The change matters at year eight, not year one.",
        sayThis: "It's an 8-year IRR story. Year one doesn't move.",
      },
      {
        persona: "Buyers Agent",
        angle: "Long-hold investors are the most affected. Open the conversation before they ask.",
        sayThis: "Long-hold investors are the ones affected. Open the conversation, don't wait for it.",
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
        persona: "Institutional",
        angle: "Supply-chain resilience story for boards. Procurement gets a longer leash.",
        sayThis: "Onshoring is no longer a slide in a board deck. It's a quarter on a roadmap.",
      },
      {
        persona: "Broker",
        angle: "Semiconductor exposure is positive for long-dated industrial clients.",
        sayThis: "Industrial clients with chip exposure read this as a yes.",
      },
      {
        persona: "Adviser",
        angle: "Concentration risk in the equity-only sleeve gets a tail-risk discount.",
        sayThis: "Equity concentration in chip names just got more defensible.",
      },
      {
        persona: "Buyers Agent",
        angle: "Indirect — but a hedge against the geopolitics-and-tech narrative for property allocators.",
        sayThis: "Property allocators sleep better on news like this. It's a quiet positive.",
      },
    ],
  },

  // ── Trending / Culture — broadly relevant items that DON'T deserve
  // a forced partner angle for every persona. These demonstrate the
  // smart Say This filtering: if the active persona has no angle, the
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
    dek: "Sentiment shift on the largest Australian finance subreddit — top-three threads this week are now about fixed-rate roll-off strategy, not the cash rate path. Anecdotal but directional.",
    partnerAngles: [
      {
        persona: "Broker",
        angle: "Reddit sentiment leads broker channel volume by ~two weeks. Worth a check-in call this week.",
        sayThis:
          "AusFinance is now talking fixed-rate roll-off, not the cash rate. Your June refi book might land sooner than you think.",
      },
    ],
  },
];

export const metrics: Metric[] = [
  { key: "AUS_PROD", value: "1.2%", prior: "0.9%", detail: "vs 0.9% prior" },
  { key: "INFLATION", value: "3.4%", prior: "3.2%", detail: "headline YoY" },
  { key: "OIL_DEM", value: "102.4 mb/d", prior: "102.1 mb/d", detail: "global demand" },
  { key: "OIL_PRI", value: "$78.10", prior: "$78.57", detail: "Brent · spot" },
];

export const topics: Topic[] = [
  { category: "MACRO", label: "Macro", count: 12 },
  { category: "GEOPOLITICS", label: "Geopolitics", count: 9 },
  { category: "PROPERTY", label: "Property", count: 8 },
  { category: "MARKETS", label: "Markets", count: 6 },
  { category: "AI", label: "AI", count: 5 },
  { category: "CLIMATE", label: "Climate", count: 3 },
];

export const tickerItems: TickerItem[] = [
  { label: "RBA holds cash rate at 4.35%, language softens", category: "MACRO" },
  { label: "Sydney auction clearance 67.4% — sixth week above 65", category: "PROPERTY" },
  { label: "APRA opens consultation on 3% serviceability buffer", category: "MACRO" },
  { label: "IMF flags Iran sanctions risk to global oil supply", category: "GEOPOLITICS" },
  { label: "US-China reopen semiconductor working group", category: "GEOPOLITICS" },
  { label: "Energy reset lifts headline CPI to 3.4% YoY", category: "MACRO" },
  { label: "TSMC pulls forward Arizona phase three by nine months", category: "AI" },
  { label: "Federal Budget: CGT tweak rewrites 8-year property IRRs", category: "MACRO" },
];
