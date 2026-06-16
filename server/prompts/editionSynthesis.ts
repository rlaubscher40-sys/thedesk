/**
 * Synthesises a week of daily feed items into a structured weekly edition.
 *
 * Caller (the weekly ingest endpoint) provides the feed items; the LLM
 * returns JSON matching the edition shape (topics + signals + keyMetrics).
 * The output is parsed and validated against the weekly-edition Zod schema
 * before persisting, anything malformed throws so the caller can fall
 * back gracefully.
 */
import type { DailyFeedItem, DateToWatch } from "../db/schema";
import {
  editionTopicSchema,
  keyMetricsSchema,
  signalsSchema,
  type EditionTopic,
  type KeyMetrics,
  type Signals,
} from "../../shared/schemas";
import { z } from "zod";
import { invokeLLM } from "../core/llm";
import { rubenSystemPrompt, stripBannedChars, voiceRules } from "./voice";

/**
 * A verified, current figure pulled from the daily_metrics store (RBA cash
 * rate CSV, ABS releases, market data feeds, sourced news extraction). These
 * are the source of truth, handed to the model so it stops reconstructing
 * numbers from stale training data, and used to override the displayed
 * keyMetrics after generation.
 */
export type VerifiedMetric = {
  metricKey: string;
  label: string;
  value: string;
  unit: string | null;
  context: string | null;
  source: string | null;
  asOf: Date | null;
};

export type SynthesisInput = {
  weekRange: string;
  weekOf: string;
  items: DailyFeedItem[];
  verifiedMetrics?: VerifiedMetric[];
};

// Editorial priority for the weekly keyMetrics widget — the numbers brokers
// and advisers scrutinise most, in the order they should appear. Verified
// values for these anchor the widget; the model's own picks fill any
// remaining slots. Keys match metricKey in the daily_metrics store.
const WEEKLY_METRIC_PRIORITY = [
  "cash_rate",
  "cpi_trimmed",
  "unemployment",
  "asx200",
  "audusd",
  "dwelling_value",
  "auction_clearance",
];
const MAX_KEY_METRICS = 6;

// Maps a normalised free-text metric label to a canonical metricKey concept,
// so a model-authored "Cash rate" entry is recognised as the same thing as
// the verified "RBA cash rate" and isn't duplicated into the widget.
const METRIC_ALIASES: Record<string, string[]> = {
  cash_rate: ["cashrate", "rbacashrate", "cashratetarget", "officialcashrate"],
  cpi_trimmed: ["cpi", "inflation", "trimmedmeancpi", "trimmedmean", "headlineinflation", "coreinflation"],
  unemployment: ["unemployment", "unemploymentrate", "joblessrate"],
  asx200: ["asx", "asx200", "spasx200", "asx200index"],
  audusd: ["audusd", "aud", "australiandollar"],
  audgbp: ["audgbp"],
  audeur: ["audeur"],
  us10y: ["us10y", "us10yyield", "ustreasury10y"],
  dwelling_value: ["dwellingvalue", "dwellingvalues", "medianvalue", "homevalue", "nataldwellingvalue", "natldwellingvalue"],
  auction_clearance: ["auctionclearance", "clearancerate", "auctionclearancerate", "sydneyclearance", "melbourneclearance"],
  consumer_confidence: ["consumerconfidence", "consumersentiment"],
  mortgage_arrears: ["mortgagearrears", "arrears", "arrearsrate"],
  wage_growth: ["wagegrowth", "wpi", "wageprice"],
  building_approvals: ["buildingapprovals", "dwellingapprovals"],
  net_migration: ["netmigration", "nom", "netoverseasmigration"],
};

function normaliseLabel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Resolve a free-text metric label to a canonical metricKey concept, or
 *  null when it doesn't match any known metric. */
function conceptOf(label: string): string | null {
  const n = normaliseLabel(label);
  for (const [key, aliases] of Object.entries(METRIC_ALIASES)) {
    if (key === n || aliases.includes(n)) return key;
  }
  return null;
}

/** Render a verified metric as a display string, appending the unit unless
 *  the value already carries it ("4.35" + "%" → "4.35%"; "8,210.43" → as-is). */
function formatMetricDisplay(m: VerifiedMetric): string {
  const v = m.value.trim();
  const unit = m.unit?.trim();
  if (!unit || v.endsWith(unit)) return v;
  return unit === "%" ? `${v}%` : `${v} ${unit}`;
}

function verifiedMetricsBlock(metrics: VerifiedMetric[] | undefined): string {
  if (!metrics || metrics.length === 0) return "";
  const lines = metrics
    .map((m) => {
      const asOf = m.asOf ? ` (as of ${m.asOf.toISOString().slice(0, 10)})` : "";
      const src = m.source ? ` [${m.source}]` : "";
      const ctx = m.context ? `, ${m.context}` : "";
      return `- ${m.label}: ${formatMetricDisplay(m)}${asOf}${src}${ctx}`;
    })
    .join("\n");
  return `

VERIFIED METRICS, authoritative and current. These come straight from the RBA, ABS, live market data and sourced reporting. They are the source of truth.

${lines}

Use these EXACT values anywhere you reference them, in the body prose, the signals, the takeaways and especially keyMetrics. Your training data is stale; these are live. Do NOT recall, round away, or invent a different number for any metric covered above. If a figure you want to cite is not in this list, you may use what the source items state, but never contradict a verified value.`;
}

/**
 * Replace the model's keyMetrics with verified figures where we have them.
 * Verified anchors lead (in editorial priority order), then the model's own
 * picks fill the remaining slots, skipping anything that duplicates a concept
 * already placed. Falls back to the model's metrics untouched when no
 * verified data is available (demo mode, empty store, back-synthesis).
 */
export function groundKeyMetrics(
  modelMetrics: KeyMetrics,
  verified: VerifiedMetric[] | undefined
): KeyMetrics {
  if (!verified || verified.length === 0) return modelMetrics;
  const byKey = new Map(verified.map((m) => [m.metricKey, m]));
  const out: KeyMetrics = {};
  const usedConcepts = new Set<string>();

  for (const key of WEEKLY_METRIC_PRIORITY) {
    if (Object.keys(out).length >= MAX_KEY_METRICS) break;
    const m = byKey.get(key);
    if (!m) continue;
    out[m.label] = formatMetricDisplay(m);
    usedConcepts.add(key);
  }

  for (const [label, value] of Object.entries(modelMetrics)) {
    if (Object.keys(out).length >= MAX_KEY_METRICS) break;
    const concept = conceptOf(label);
    if (concept && usedConcepts.has(concept)) continue;
    out[label] = value;
    if (concept) usedConcepts.add(concept);
  }

  return out;
}

export type SynthesisOutput = {
  topics: EditionTopic[];
  signals: Signals;
  keyMetrics: KeyMetrics;
  readingTime: string;
  fullText: string | null;
  marketStress: "low" | "moderate" | "high" | null;
  datesToWatch: DateToWatch[] | null;
};

const dateToWatchSchema = z.object({
  label: z.string().min(1).max(48),
  description: z.string().min(1).max(400),
});

const synthesisSchema = z.object({
  // Minimum 5 topics, four topics ended up reading as thin in the real
  // world, and the coverage mandate below targets five distinct beats.
  topics: z.array(editionTopicSchema).min(5).max(7),
  signals: signalsSchema.min(6).max(14),
  keyMetrics: keyMetricsSchema,
  readingTime: z.string().max(32).optional(),
  fullText: z.string().optional().nullable(),
  marketStress: z.enum(["low", "moderate", "high"]).optional().nullable(),
  datesToWatch: z.array(dateToWatchSchema).max(12).optional().nullable(),
});

function formatItems(items: DailyFeedItem[]): string {
  return items
    .slice(0, 80)
    .map(
      (it, i) =>
        `${i + 1}. [${it.category}] ${it.title}\n   Source: ${it.source}\n   ${it.summary}`
    )
    .join("\n\n");
}

function buildPrompt(input: SynthesisInput): string {
  return `You are compiling the WEEKLY EDITION of The Desk, a deep-dive intelligence briefing for Australian property investment professionals, curated by Ruben Laubscher.

This is the long-form companion to the daily feed. Readers come here to UNDERSTAND, not skim. Each topic gets a full analytical treatment, context, argument, evidence, implication, what to do about it. Think Bloomberg Opinion, FT Lex, or Stratechery, not a press release recap.

Audience: brokers, financial advisers, accountants, buyer's agents, SMSF specialists. They read 40 sources a week and walk into client meetings sounding sharper than the headlines. Your job is to tell them what it MEANS and what to SAY.

This week's range: ${input.weekRange} (week of ${input.weekOf})

COVERAGE MANDATE, non-negotiable. The edition MUST include at least one topic from EACH of these five beats. Repeating a beat is allowed, missing a beat is not unless the week's source material genuinely contained nothing in that lane.

  1. Property, Australian housing, prices, listings, auctions, broker channel.
  2. Macro / Policy, rates, RBA, APRA, ASIC, federal budget, regulatory change.
  3. Geopolitics, international events that move capital, trade, currencies, or the rules of business in Australia. AUKUS, China, US politics, Middle East, Europe.
  4. Tech / AI, only when it materially moves money or workflows in Australia or is a global pivot point partners need to understand.
  5. Wider-world / culture, a non-domestic story or trend that changes how partners read the room. Could be sport-of-business, a science milestone, a major cultural shift, a death of a notable figure, a viral movement. NOT domestic sport scores.

If you find yourself shipping fewer than 5 topics, you have missed a beat, go back through the source items and find the missing angle. A weekly edition that covers only Property + Policy reads as half a brief.

Each topic must synthesise 2-5 related daily items, not just restate one. If two topics start to feel redundant, merge them.

Below is every story logged on the daily feed across the week. Synthesise them into a structured weekly edition.

${formatItems(input.items)}
${verifiedMetricsBlock(input.verifiedMetrics)}

---

${voiceRules}

---

Output a SINGLE JSON object matching this exact shape, and NOTHING ELSE, no preamble, no markdown fences, no commentary:

{
  "topics": [
    {
      "title": "Headline (max 14 words). States the argument, not the news.",
      "summary": "2-3 sentence editorial lede. The setup, not the recap. Reads like the opening of a Stratechery or FT Lex column.",
      "category": "MACRO | PROPERTY | POLICY | MARKETS | AI | TECH | GEOPOLITICS | SCIENCE | ECONOMICS | OTHER",
      "body": "600-800 word analytical deep-dive. Plain prose, multiple paragraphs separated by blank lines. NO bullet points, NO markdown, NO subheadings.\\n\\nStructure each body around four implicit beats:\\n  1. WHAT HAPPENED, one tight paragraph grounding the reader in the week's facts. Concrete numbers, dates, named entities.\\n  2. WHY IT MATTERS, two or three paragraphs of analysis. What does this change for the partner channel? What's the second-order effect? What did the consensus get wrong?\\n  3. WHAT TO WATCH, a paragraph on the next 1-4 weeks. Specific data releases, decisions, or signals.\\n  4. WHAT IT MEANS FOR YOU, a closing paragraph that lands the partner-channel implication. Not advice, framing.\\n\\nWrite like an editor who has sat with the week's stories for an hour and is now telling a sharp broker what they need to know. The lead topic (first in the array) gets the most substantive treatment.",
      "keyTakeaway": "One sentence Ruben could repeat verbatim to a client over coffee. The compressed version of the whole argument. This is the line.",
      "whyItMatters": "One explicit sentence answering 'why does the partner channel care about this specifically, right now'. Not the takeaway, not the headline, the audience-relevance hook. Specific to brokers/advisers/buyer's agents in Australia this week, not generic.",
      "whatToWatch": [
        "Specific forward-looking item, a data release, decision, or event in the next 1-4 weeks",
        "Second watch item",
        "Optional third"
      ],
      "talkingPoints": {
        "Broker": "One sentence, what a mortgage broker says to a client tomorrow about this. Specific. Action-oriented. Not 'rates are uncertain', but 'lock in if the fixed-rate roll-off lands in June'.",
        "Adviser": "One sentence, what a financial adviser or accountant says about the wealth-strategy, tax structure, or SMSF implication. The second-order read.",
        "Buyers Agent": "One sentence, what a buyer's agent says about deal flow, suburb-level shifts, listings velocity, or market timing."
      }
    }
    // ... 5 to 7 topics total spanning the five-beat coverage mandate above. The FIRST topic is the lead, most consequential of the week, longest body, drives the whole edition.
  ],
  "signals": [
    { "text": "one-line signal, short, sharp, max 18 words, names a thing that moved", "category": "MACRO | PROPERTY | POLICY | MARKETS | AI | TECH | GEOPOLITICS | SCIENCE | ECONOMICS | OTHER" },
    // ... 8 to 12 total. NOT topic summaries. These are the "what's also moving" rail, quick hits the reader scans across the top of the edition. Each MUST carry a category, the beat it belongs to, so the reader can scan signals grouped. Cover diverse beats: a rate move, an APRA note, a listings stat, a global headline, a tech / AI item, a cultural beat. Variety > quantity.
  ],
  "keyMetrics": {
    "Cash rate": "4.35%",
    "ASX 200": "8,210",
    // ... 4-6 numbers that matter this week; values can be strings or numbers.
    // Draw from the VERIFIED METRICS block above using their exact values.
    // Any verified figure will be reconciled against the source data after
    // generation, so never substitute a remembered number for a verified one.
  },
  "fullText": "800-1200 word editor's letter. The unifying narrative that flows ACROSS the topics. Answers 'why does it all add up'. Written as Ruben, direct, plain, commercially sharp. First paragraph hooks with the through-line. Middle paragraphs link the topics. Last paragraph leaves the reader with something to think about heading into next week. Use null only if the topics genuinely have no through-line.",
  "readingTime": "10 min",
  "marketStress": "low | moderate | high, single overall sentiment indicator. 'low' = stable / repairing, 'moderate' = mixed signals, 'high' = stress / dislocation. Set based on the week's tone across rates, listings, lending, geopolitics.",
  "datesToWatch": [
    {
      "label": "May 21",
      "description": "ABS April labour force data. First reading that fully captures the employment impact of recent rate moves."
    },
    {
      "label": "June 16",
      "description": "Next RBA decision. CommBank, NAB, ANZ Research all expect a hold at 4.35%."
    }
    // ... 5-8 forward-looking entries, release dates, decisions, hearings, settlements, expiries. Cover the next 4-8 weeks. Each label is a short date or "Ongoing"; description is one sentence explaining what's at stake.
  ]
}

CRITICAL voice rules, Ruben's house style:
- Direct. Plain. Commercially sharp.
- Australian English.
- No em dashes anywhere.
- No question marks in titles, summaries, or takeaways.
- No first person ("I think", "in my view"), the editorial voice is implicit.
- No hype words: "groundbreaking", "game-changing", "unprecedented".
- No generic AI phrasing: "in today's rapidly evolving landscape", "delve into", "navigate".
- Never use "literally", "actually", "frankly", "to be honest".
- Never use "moreover", "furthermore", "in conclusion".
- Numbers and proper nouns spell themselves, don't pad with adjectives.

Other rules:
- The body is where the value lives. Don't skimp. 600-800 words. Multi-paragraph flowing prose.
- Each topic must synthesise 2-5 related daily items, not just restate one.
- Talking points must be PRACTICAL, what the partner literally SAYS in a meeting tomorrow. Specific, not vague.
- Key metrics must be plausible and consistent with the source items. Do not fabricate.
- Output valid JSON only. No trailing commas. No comments.`;
}

export async function synthesizeWeeklyEdition(input: SynthesisInput): Promise<SynthesisOutput> {
  if (input.items.length === 0) {
    throw new Error("synthesizeWeeklyEdition: no feed items provided");
  }

  const content = await invokeLLM({
    messages: [
      { role: "system", content: rubenSystemPrompt },
      { role: "user", content: buildPrompt(input) },
    ],
    tier: "premium",
  });

  // Strip any markdown fences the model might have wrapped around the JSON.
  let json = content.trim();
  const fenced = json.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced && fenced[1]) json = fenced[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(`synthesizeWeeklyEdition: model returned invalid JSON: ${(err as Error).message}`);
  }

  const validated = synthesisSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `synthesizeWeeklyEdition: output failed schema: ${JSON.stringify(validated.error.flatten())}`
    );
  }

  // Banned-char pass on every text field so the editorial polish stays consistent.
  return {
    topics: validated.data.topics.map((t) => ({
      ...t,
      title: stripBannedChars(t.title),
      summary: stripBannedChars(t.summary),
      body: t.body ? stripBannedChars(t.body) : undefined,
      keyTakeaway: t.keyTakeaway ? stripBannedChars(t.keyTakeaway) : undefined,
      whyItMatters: t.whyItMatters ? stripBannedChars(t.whyItMatters) : undefined,
      whatToWatch: t.whatToWatch?.map((s) => stripBannedChars(s)),
      talkingPoints: t.talkingPoints
        ? Object.fromEntries(
            Object.entries(t.talkingPoints).map(([k, v]) => [k, stripBannedChars(v)])
          )
        : undefined,
    })),
    signals: validated.data.signals.map((s) =>
      typeof s === "string"
        ? stripBannedChars(s)
        : { ...s, text: stripBannedChars(s.text) }
    ),
    // Override the model's figures with verified ones where we have them, so
    // the displayed widget can never ship a number the model misremembered.
    keyMetrics: groundKeyMetrics(validated.data.keyMetrics, input.verifiedMetrics),
    readingTime: validated.data.readingTime ?? "6 min",
    fullText: validated.data.fullText ? stripBannedChars(validated.data.fullText) : null,
    marketStress: validated.data.marketStress ?? null,
    datesToWatch:
      validated.data.datesToWatch?.map((d) => ({
        label: stripBannedChars(d.label),
        description: stripBannedChars(d.description),
      })) ?? null,
  };
}
