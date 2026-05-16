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
  fullText: string | null;
};

const synthesisSchema = z.object({
  topics: z.array(editionTopicSchema).min(3).max(7),
  signals: signalsSchema.min(4).max(12),
  keyMetrics: keyMetricsSchema,
  readingTime: z.string().max(32).optional(),
  fullText: z.string().optional().nullable(),
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
  return `You are compiling the WEEKLY EDITION of The Desk — a deep-dive intelligence briefing for Australian property investment professionals, curated by Ruben Laubscher (Head of Partnerships, InvestorKit).

This is the long-form companion to the daily feed. Readers come here to UNDERSTAND, not skim. Each topic gets a full analytical treatment — argument, evidence, implication. Think Bloomberg Opinion or FT Lex column, not a press release recap.

Audience: brokers, financial advisers, accountants, buyer's agents, SMSF specialists. They read 40 sources a week. Your job is to tell them what it MEANS.

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
      "title": "Headline (max 14 words). Not clickbait. State the argument.",
      "summary": "2-3 sentence editorial lede that sets up the argument the body will make. NOT a news summary. Read like the opening of a Stratechery or FT Lex column.",
      "category": "MACRO | PROPERTY | POLICY | MARKETS | AI | TECH | GEOPOLITICS | SCIENCE | ECONOMICS | OTHER",
      "body": "400-600 word analytical deep-dive. Multiple paragraphs separated by blank lines. Argues a specific point. Uses concrete details from the week's stories (numbers, quotes, names). No bullet points or markdown. Flowing prose. Tells the reader what the data MEANS and what changes for their practice, not what happened. Reads like an editor sat with the week's stories for an hour and wrote a considered piece.",
      "keyTakeaway": "One sentence Ruben could repeat verbatim to a client over coffee. The compressed version of the whole topic.",
      "whatToWatch": [
        "Forward-looking watch item — a specific data release, decision, or event in the next 1-4 weeks",
        "Second watch item",
        "Optional third"
      ],
      "talkingPoints": {
        "Brokers": "One sentence — what a mortgage broker would say to a client tomorrow about this. Action-oriented.",
        "Financial Advisers": "One sentence — what an adviser/accountant would say about the wealth-strategy implication.",
        "Buyer's Agents": "One sentence — what a BA would say about the deal-flow / market-timing implication.",
        "SMSF Specialists": "One sentence — what an SMSF specialist would say about superannuation / structure implications. Skip if no clear angle exists rather than fabricating one."
      }
    }
    // ... 4 to 6 topics total. FIRST topic is the LEAD — the most consequential of the week. Give the lead the most substantial body (550-650 words). The lead drives the whole edition.
  ],
  "signals": [
    "one-line signal — short, sharp, max 18 words",
    // ... 6 to 10 total. NOT topic summaries — these are the "what's also moving" rail. Things that didn't earn a topic but matter.
  ],
  "keyMetrics": {
    "Cash rate": "4.35%",
    "ASX 200": "8,210",
    // ... 4-6 numbers that matter this week; values can be strings or numbers
  },
  "fullText": "Optional 800-1200 word editor's letter that flows ACROSS the topics and gives readers a unified narrative of the week. Answers 'why does it all add up'. Written in Ruben's voice, first paragraph hooks, last paragraph leaves them thinking. Skip (use null) only if the topics already cover the through-line.",
  "readingTime": "8 min"
}

CRITICAL — the body is where the value lives:
- Do NOT just summarise the stories. Argue a point about them.
- Use concrete numbers, dates, names from the source items.
- Each body must work as a standalone read — opening hook, evidence, implication, close.
- Use double line breaks between paragraphs. Plain text, no markdown.
- No first-person ("I think...") — the editorial voice is implicit.
- No "as we noted last week" — every edition stands alone.
- No bullet lists inside body — flowing prose.

Other rules:
- Group stories by theme. Each topic synthesises 2-5 related daily items.
- Mix categories — at least one MACRO/rates, at least one PROPERTY, at least one POLICY when the week's data supports it.
- Talking points must be PRACTICAL — what the partner literally SAYS in a meeting tomorrow. Not vague observations.
- Key metrics must be plausible and consistent with the source items. Do not fabricate.
- Australian English. No em dashes. No question marks in titles, summaries or takeaways.
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
      talkingPoints: t.talkingPoints
        ? Object.fromEntries(
            Object.entries(t.talkingPoints).map(([k, v]) => [k, stripBannedChars(v)])
          )
        : undefined,
    })),
    signals: validated.data.signals.map((s) => stripBannedChars(s)),
    keyMetrics: validated.data.keyMetrics,
    readingTime: validated.data.readingTime ?? "6 min",
    fullText: validated.data.fullText ? stripBannedChars(validated.data.fullText) : null,
  };
}
