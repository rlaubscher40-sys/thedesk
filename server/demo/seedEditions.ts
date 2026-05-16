/**
 * Three weekly editions seeded for demo mode. Each one has 4-5 topics, a
 * full Ruben's Take, key metrics and signals so every section in
 * EditionReader has something to render.
 */
import type { Edition } from "../db/schema";

const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * 86400000);

export function editionsSeed(): Edition[] {
  return [
    {
      id: 1,
      editionNumber: 14,
      weekOf: "2026-05-06",
      weekRange: "May 6 – May 12, 2026",
      publishedAt: daysAgo(2),
      pdfUrl: "demo://edition/14",
      readingTime: "9 min",
      heroImageUrl: null,
      fullText:
        "Cash rate held. Broker channel share crept up. APRA published a softer serviceability paper. Sentiment is louder than the data.",
      keyMetrics: {
        "Cash Rate": "4.35%",
        "AUD/USD": "0.659",
        "Sydney Auction Clearance": "67.4%",
        "Broker Channel Share": "74.6%",
        "10Y AGB": "4.21%",
        "ASX 200": "8,210",
      },
      signals: [
        "Fixed-rate roll-off volume peaks in mid-June. Conversations should plan around it now, not after.",
        "APRA's softer serviceability draft is a signal, not a decision. Wait for the response submissions.",
        "Sydney clearance has been above 65% for six weeks. The volume side is finally catching up.",
        "Energy bills are doing more work on the inflation print than rent is. Brokers should know this.",
        "Three buyer agencies in Melbourne quietly stopped taking new clients. Capacity, not demand.",
      ],
      rubensTake:
        "The decision was the easy part. The interesting story is what the broker channel does in the four weeks after a hold. Last cycle that's where the real action was, and the pattern is rhyming. Watch fixed-rate roll-off volumes, not the cash rate.",
      substackDraftTitle: "The Decision Was the Easy Part",
      substackDraftSubtitle:
        "What the broker channel does in the four weeks after a hold tells you more than the hold itself.",
      substackDraftBody:
        "I was on a call with a broker friend the morning the decision dropped. He had three settlements lined up that afternoon and a presentation at five.\n\nThe RBA had just held the cash rate at 4.35%. Nothing about his day changed. Nothing about his clients' files changed. The presentation he was giving had been written a week earlier and would have read the same either way.\n\n---\n\nThe decision is the headline. The interesting story is the four weeks after.\n\nLast cycle, when the RBA held in March and again in May, broker channel share crept up almost a full percentage point through June. Not because anyone changed their mind. Because the holds gave clients permission to sit still, and sitting still in a refi market means the existing broker keeps the relationship.\n\nThis time, the data is starting to rhyme. Channel share moved from 73.8% to 74.6% between the last decision and this one. Not dramatic. But the direction matters more than the number.\n\nWhat's a partner conversation in this look like? Not 'rates are holding.' Everyone says that. The angle is what fixed-rate roll-off volumes do in mid-June, because that's where the real decisions get made.\n\n---\n\n_If this landed, I write two of these a week. Subscribe and I'll send them straight to your inbox._",
      substackDraftImageUrl: null,
      marketStress: null,
      datesToWatch: null,
      createdAt: daysAgo(2),
      topics: [
        {
          title: "RBA holds at 4.35%, but the post-decision tape is the story",
          summary:
            "The decision was the consensus call. The four weeks after a hold is where channel share moves and conversations should reset.",
          category: "MACRO",
          partnerRelevance: ["Brokers", "Financial Advisers"],
          body:
            "The Reserve Bank held the cash rate at 4.35% in a decision the swap market had priced 30 minutes before. The interesting part of the press conference was the line about 'patient transmission' — the Bank is telling the market that the lagged effect of the prior tightening is still working through.\n\nIn the four weeks after the last two holds, broker channel share moved from 73.8% to 74.6%. Not dramatic, but directionally significant. Sitting still in a refi market favours the incumbent broker.\n\nThe practical read for partner conversations: the question to ask is not 'are rates moving?' Everyone is asking that. Ask 'where are your fixed-rate roll-offs landing in June?'",
          keyTakeaway:
            "Channel share moves in the four weeks after a hold. June fixed-rate roll-off is the real number to watch.",
          whatToWatch: [
            "Mid-June fixed-rate roll-off volume (RBA data releases on the 15th)",
            "May broker channel share — published end of month",
            "Wage price index print on the 21st",
          ],
          talkingPoints: {
            Brokers:
              "If you only watch one number this week, watch fixed-rate roll-off volumes. June is where the real decisions get made.",
            "Financial Advisers":
              "Hold decisions look static but channel share moves in the lull after them. Position your clients for refi conversations now.",
            Accountants:
              "Serviceability is doing more work than the headline rate. Your clients' borrowing power has not held at the same level the cash rate has.",
            "SMSF Specialists":
              "LRBA pricing rarely follows the cash rate cleanly. Watch what the major banks do on SMSF-specific products in the next fortnight.",
          },
        },
        {
          title: "APRA softens serviceability paper, but it's a draft",
          summary:
            "The consultation paper proposes a buffer review, not a buffer cut. Take the direction seriously and the timing not at all.",
          category: "POLICY",
          partnerRelevance: ["Brokers"],
          body:
            "APRA published a consultation paper on the serviceability assessment buffer, suggesting it would 'review the appropriateness' of the current 3% level. Broker forums read that as a buffer cut. APRA read it as starting a conversation that will take six months.\n\nThe submissions window closes on June 20. The earliest a revised regime could land is late Q3. Anyone selling 'serviceability is loosening' to clients today is selling timing they cannot deliver.",
          keyTakeaway:
            "Direction softer, timing distant. Don't price client conversations off this yet.",
          whatToWatch: [
            "Bank submissions — CBA traditionally telegraphs APRA's direction",
            "ABA's response paper, expected end of June",
          ],
          talkingPoints: {
            Brokers:
              "Read the paper, not the headlines about the paper. The buffer review is a Q4 story at the earliest.",
          },
        },
        {
          title: "Sydney auction clearance over 65% for six straight weeks",
          summary:
            "Volume is catching up with the price story. The lower-end market is doing the work; the prestige segment is still patient.",
          category: "PROPERTY",
          partnerRelevance: ["Buyers Agents"],
          body:
            "The 67.4% clearance rate this weekend was the sixth in a row above 65%. The number to watch underneath it is auction volume — 932 listings, up 18% on the same week last year. Stock is moving and the under-$1.5m segment is doing most of the work.\n\nThe prestige segment ($3m+) cleared 51%. Buyers in that band are still patient, but agents are reporting more pre-auction offers. That usually precedes a clearance lift by 4-6 weeks.",
          keyTakeaway:
            "The bottom half of the market is hot. The top half is warming.",
          whatToWatch: [
            "Pre-auction offer volumes in the $3m+ band",
            "New listing volumes — June is the test",
          ],
          talkingPoints: {
            "Buyers Agents":
              "Capacity is the bigger conversation than price right now. Three Melbourne BAs paused intake this week.",
          },
        },
        {
          title: "Energy bills are doing more inflation work than rents",
          summary:
            "The monthly inflation print is being shaped by electricity reset cycles more than housing. The composition matters for the next RBA call.",
          category: "ECONOMICS",
          partnerRelevance: ["Financial Advisers", "Accountants"],
          body:
            "Headline inflation came in at 3.4% YoY but the composition is what matters. Electricity prices rose 6.1% on the back of the July 1 retail reset, and that one line item contributed roughly a quarter of the print.\n\nHousing-related inflation, which everyone reads as 'rents', was softer than expected. New rents are running at 7.3% but the broader CPI rents measure is at 5.1% and slowing.",
          keyTakeaway:
            "If energy resets keep the headline elevated, the RBA's patience extends. That's the real read.",
          whatToWatch: [
            "Q3 monthly CPI — electricity will roll off the YoY base in October",
            "New rent indices from CoreLogic and SQM",
          ],
          talkingPoints: {
            "Financial Advisers":
              "Use the composition, not the headline, when you frame the rates outlook for clients.",
          },
        },
        {
          title: "Three buyer agencies in Melbourne stopped taking new clients",
          summary:
            "Capacity, not demand, is the constraint at the top of the market. The story is mid-tier BAs without a national engine behind them.",
          category: "PROPERTY",
          partnerRelevance: ["Buyers Agents"],
          body:
            "Three well-known Melbourne buyer agencies quietly closed intake this week. None of them have published anything; one BA's website now reads 'currently servicing existing clients only'.\n\nThe constraint is operational. They have files, they cannot service. This is a recurring pattern in mid-tier agencies without a structured intake or partnerships engine.",
          keyTakeaway:
            "Demand is fine. Capacity at the mid-tier is the constraint, and partner channels solve for that.",
          whatToWatch: [
            "Whether intake reopens at the same fee level or higher",
            "Referral patterns to nationally-scaled agencies",
          ],
          talkingPoints: {
            "Buyers Agents":
              "If a mid-tier in your market just paused intake, that's where their referrals are sitting. Pick up the phone.",
          },
        },
      ],
    },
    {
      id: 2,
      editionNumber: 13,
      weekOf: "2026-04-29",
      weekRange: "Apr 29 – May 5, 2026",
      publishedAt: daysAgo(9),
      pdfUrl: "demo://edition/13",
      readingTime: "8 min",
      heroImageUrl: null,
      fullText:
        "Federal budget delivered. CGT exemption tweak rewrites IRR maths for held investment property over 8 years.",
      keyMetrics: {
        "Cash Rate": "4.35%",
        "AUD/USD": "0.661",
        "Sydney Auction Clearance": "65.1%",
        "Broker Channel Share": "73.9%",
        "ASX 200": "8,140",
      },
      signals: [
        "The CGT discount change is a yield story masquerading as a tax story.",
        "Treasurer's framing of 'productive investment' is the line to watch for the next 18 months.",
        "Major banks have begun re-pricing SMSF LRBAs. Quietly.",
        "Three of the big four cut broker commission claw-back windows by 30 days.",
      ],
      rubensTake:
        "The budget did not change a single number on a client's spreadsheet today. It changed the maths on every spreadsheet eight years out. The advisers who win the next 18 months will be the ones who can model that without making it feel like homework.",
      substackDraftTitle: "The Budget Change That Rewrites Property Returns",
      substackDraftSubtitle: "Eight years out is where the new numbers live.",
      substackDraftBody:
        "I read the budget papers on the flight back from Melbourne.\n\nThe CGT discount tweak is two paragraphs on page 147. Most of the morning coverage missed it. By Friday it'll be the only thing anyone talks about.\n\n_If this landed, I write two of these a week. Subscribe and I'll send them straight to your inbox._",
      substackDraftImageUrl: null,
      marketStress: null,
      datesToWatch: null,
      createdAt: daysAgo(9),
      topics: [
        {
          title: "Federal Budget: CGT discount tweak rewrites long-hold IRRs",
          summary:
            "Two paragraphs on page 147 of the budget papers reshape the maths on held investment property. The IRR impact lands at year eight.",
          category: "POLICY",
          partnerRelevance: ["Financial Advisers", "Accountants", "Buyers Agents"],
          keyTakeaway:
            "The change is small, but it shows up in 8-year IRRs. Model it for clients who hold long.",
          whatToWatch: [
            "Treasury's explanatory memo, due next week",
            "Major accounting firm interpretations",
          ],
          talkingPoints: {
            "Financial Advisers":
              "Refresh your held-property IRR models with the new discount rate. The change matters at year eight, not year one.",
            Accountants:
              "Clients holding investment property for 8+ years see the largest impact. Worth a proactive call.",
          },
        },
        {
          title: "SMSF LRBA pricing quietly re-rates",
          summary:
            "Three of the big four widened LRBA-specific margins this week. The market is not noticing yet.",
          category: "MARKETS",
          partnerRelevance: ["SMSF Specialists"],
          keyTakeaway:
            "SMSF borrowing got marginally more expensive. The deal-by-deal differential is showing.",
          talkingPoints: {
            "SMSF Specialists":
              "If a client is in the SMSF property pipeline, lock the indicative this fortnight.",
          },
        },
        {
          title: "Broker commission claw-back windows shorten",
          summary:
            "Three of the big four reduced claw-back windows by 30 days. Operational, not headline, but real money for brokers.",
          category: "POLICY",
          partnerRelevance: ["Brokers"],
          keyTakeaway:
            "If you write through these lenders, the unit economics of refis improved this week.",
          talkingPoints: {
            Brokers:
              "The change is paid retroactively on settled loans. Check what your aggregator's flagged.",
          },
        },
        {
          title: "AI underwriting pilot at one major bank moves to second cohort",
          summary:
            "The pilot is wider than the bank publicly says. Brokers are seeing approvals come through faster on edge cases.",
          category: "AI",
          partnerRelevance: ["Brokers"],
          keyTakeaway:
            "Speed gains are real. Some edge cases get reviewed by AI first, human second.",
        },
      ],
    },
    {
      id: 3,
      editionNumber: 12,
      weekOf: "2026-04-22",
      weekRange: "Apr 22 – Apr 28, 2026",
      publishedAt: daysAgo(16),
      pdfUrl: "demo://edition/12",
      readingTime: "7 min",
      heroImageUrl: null,
      fullText:
        "Wage price index print firmer than consensus. Property listings up 14% YoY. Apprenticeship policy nudges trades supply.",
      keyMetrics: {
        "Cash Rate": "4.35%",
        "AUD/USD": "0.654",
        "Sydney Auction Clearance": "63.8%",
        "Broker Channel Share": "73.6%",
        "ASX 200": "8,075",
      },
      signals: [
        "Wages firmer than expected — the RBA's 'patient transmission' line is getting tested.",
        "Listings up 14% YoY in capital cities. Stock catching up with demand.",
        "Apprenticeship reform is a trades-supply story 24-36 months out.",
      ],
      rubensTake:
        "Wages do not move markets the way headlines suggest. The composition does. This week's print was firmer on private services, which is where the RBA wants the cooling. The narrative will simplify it. The data has not.",
      substackDraftTitle: null,
      substackDraftSubtitle: null,
      substackDraftBody: null,
      substackDraftImageUrl: null,
      marketStress: null,
      datesToWatch: null,
      createdAt: daysAgo(16),
      topics: [
        {
          title: "Wage Price Index firmer than consensus",
          summary:
            "Private-sector services drove the upside. That's the segment the RBA wants softer, so the patience story gets tested.",
          category: "ECONOMICS",
          partnerRelevance: ["Financial Advisers"],
          keyTakeaway:
            "Composition matters. Headline beat is less interesting than where the beat came from.",
        },
        {
          title: "Listings up 14% YoY across the capital cities",
          summary:
            "Stock is catching up. The market is no longer auction-tight. Buyers' agents have inventory to work with.",
          category: "PROPERTY",
          partnerRelevance: ["Buyers Agents"],
          keyTakeaway:
            "Inventory is back. The conversation shifts from 'find anything' to 'find the right one'.",
        },
        {
          title: "Apprenticeship reform: 24-month trades-supply story",
          summary:
            "The federal reform package targets apprentice numbers, but the construction pipeline impact lands in 2028.",
          category: "POLICY",
          partnerRelevance: [],
          keyTakeaway:
            "Slow burn. Not a 2026 story.",
        },
        {
          title: "Major retailer cuts forward order on home goods 18%",
          summary:
            "A coincident indicator on household discretionary spend. Worth tracking quarter to quarter.",
          category: "MARKETS",
        },
      ],
    },
  ];
}
