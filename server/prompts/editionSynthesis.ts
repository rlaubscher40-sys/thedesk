/**
 * Synthesises a week of daily feed items into a structured weekly edition.
 *
 * Caller (the weekly ingest endpoint) provides the feed items; the LLM
 * returns JSON matching the edition shape (topics + signals + keyMetrics).
 * The output is parsed and validated against the weekly-edition Zod schema
 * before persisting — anything malformed throws so the caller can fall
 * back gracefully.
 */
import type { DailyFeedItem } from "../db/schema";
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

export type SynthesisInput = {
  weekRange: string;
  weekOf: string;
  items: DailyFeedItem[];
};

export type SynthesisOutput = {
  topics: EditionTopic[];
  signals: Signals;
  keyMetrics: KeyMetrics;
  readingTime: string;
};

const synthesisSchema = z.object({
  topics: z.array(editionTopicSchema).min(3).max(7),
  signals: signalsSchema.min(4).max(12),
  keyMetrics: keyMetricsSchema,
  readingTime: z.string().max(32).optional(),
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
  return `You are compiling the weekly edition of The Desk — an intelligence briefing for Australian property investment professionals, curated by Ruben Laubscher (Head of Partnerships, InvestorKit).

This week's range: ${input.weekRange} (week of ${input.weekOf})

Below is every story logged on the daily feed across the week. Synthesise them into a structured weekly edition.

${formatItems(input.items)}

---

${voiceRules}

---

Output a SINGLE JSON object matching this exact shape, and NOTHING ELSE — no preamble, no markdown fences, no commentary:

{
  "topics": [
    {
      "title": "headline (max 14 words, no clickbait)",
      "summary": "2-3 sentence lead that lands the insight",
      "category": "MACRO | PROPERTY | POLICY | MARKETS | AI | TECH | GEOPOLITICS | SCIENCE | ECONOMICS | OTHER",
      "keyTakeaway": "one sentence Ruben could repeat verbatim to a client",
      "whatToWatch": ["1-2 forward-looking watch items"]
    }
    // ... 4 to 6 topics total
  ],
  "signals": [
    "one-line signal",
    // ... 6 to 10 total — short, sharp, single sentence each
  ],
  "keyMetrics": {
    "Cash rate": "4.35%",
    "ASX 200": "8,210",
    // ... 4-6 numbers that matter this week; values can be strings or numbers
  },
  "readingTime": "8 min"
}

Rules:
- Group stories by theme. Each topic should pull together 2-5 related daily items into one synthesised view, not just restate one item.
- Mix the categories — at least one MACRO/RATES, at least one PROPERTY, at least one POLICY.
- Signals are NOT topic summaries. They're the "what's also moving" rail — single sentences, max 18 words each, can reference data points or quotes.
- Key metrics must be plausible numbers consistent with the week's stories. If a metric isn't supported by the source items, leave it out — don't fabricate.
- Australian English. No em dashes. No question marks. No first-person.
- Output valid JSON only. No trailing commas. No comments in the actual output.`;
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
      whatToWatch: t.whatToWatch?.map((s) => stripBannedChars(s)),
    })),
    signals: validated.data.signals.map((s) => stripBannedChars(s)),
    keyMetrics: validated.data.keyMetrics,
    readingTime: validated.data.readingTime ?? "6 min",
  };
}
