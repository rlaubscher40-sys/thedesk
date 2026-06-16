/**
 * Generates "Last week, in review", the accountability loop on the weekly
 * edition. Given the prior edition's forward-looking calls (its datesToWatch,
 * each topic's whatToWatch and keyTakeaway) and this week's actual feed
 * items, it scores how those calls played out. This is the thing that turns
 * a briefing into something professionals trust: it closes the loop and is
 * willing to say "too early" or "we got this wrong", in Ruben's calm voice
 * that refuses to perform certainty.
 *
 * Returns null when there is no prior edition, nothing concrete to score, or
 * on any failure, the caller treats null as "no look-back this week".
 */
import { z } from "zod";
import type { DailyFeedItem, DateToWatch } from "../db/schema";
import type { EditionTopic, Lookback } from "../../shared/schemas";
import { lookbackSchema } from "../../shared/schemas";
import { invokeLLM } from "../core/llm";
import { rubenSystemPrompt, stripBannedChars, voiceRules } from "./voice";

export type LookbackInput = {
  priorWeekRange: string;
  priorTopics: EditionTopic[];
  priorDatesToWatch: DateToWatch[] | null;
  thisWeekItems: DailyFeedItem[];
};

function priorCalls(input: LookbackInput): string {
  const lines: string[] = [];
  for (const t of input.priorTopics) {
    if (t.keyTakeaway) lines.push(`- [${t.category}] Claim: ${t.keyTakeaway}`);
    for (const w of t.whatToWatch ?? []) lines.push(`- [${t.category}] Watch: ${w}`);
  }
  for (const d of input.priorDatesToWatch ?? []) {
    lines.push(`- Calendar: ${d.label}, ${d.description}`);
  }
  return lines.join("\n");
}

function thisWeek(items: DailyFeedItem[]): string {
  return items
    .slice(0, 60)
    .map((it, i) => `${i + 1}. [${it.category}] ${it.title}\n   ${it.summary}`)
    .join("\n\n");
}

function buildPrompt(input: LookbackInput): string {
  return `You are writing "Last week, in review" for The Desk, a weekly intelligence briefing for Australian property investment professionals, curated by Ruben Laubscher.

This is the accountability section. Last week's edition made forward-looking calls: things to watch, takeaways, dated events. Your job is to honestly assess how they played out against what actually happened this week. Readers trust this section precisely because it does not flinch, if a call was wrong or premature, say so plainly.

LAST WEEK (${input.priorWeekRange}), the calls made:
${priorCalls(input)}

THIS WEEK, what actually happened (the daily feed):
${thisWeek(input.thisWeekItems)}

---

${voiceRules}

---

Pick the 2 to 5 most substantive calls from last week that THIS WEEK'S material lets you actually assess. Do not invent outcomes the feed does not support. For each, give:
- reference: what last week flagged or claimed, compressed to one clause
- outcome: what actually happened this week, grounded in the feed, one sentence
- verdict: exactly one of
    "played-out"  (the call was right, it happened)
    "on-track"    (developing as expected, not yet resolved)
    "too-early"   (the watched event has not landed yet)
    "missed"      (the call was wrong, or the opposite happened)

Be willing to use "missed" and "too-early". A review where everything was right reads as marking your own homework.

If last week's calls are too vague to assess, or this week's feed says nothing about any of them, return an empty items array.

Output a SINGLE JSON object, NOTHING ELSE, no markdown fences, no preamble:

{
  "summary": "1-2 sentence intro framing how last week's read held up overall. Calm, specific, no throat-clearing.",
  "items": [
    { "reference": "...", "outcome": "...", "verdict": "played-out | on-track | too-early | missed" }
    // 2 to 5 items, omit any you cannot honestly assess
  ]
}`;
}

export async function generateLookback(input: LookbackInput): Promise<Lookback | null> {
  if (input.priorTopics.length === 0 || input.thisWeekItems.length === 0) {
    return null;
  }

  let content: string;
  try {
    content = await invokeLLM({
      messages: [
        { role: "system", content: rubenSystemPrompt },
        { role: "user", content: buildPrompt(input) },
      ],
      maxTokens: 2_000,
      tier: "premium",
    });
  } catch (err) {
    console.warn("[lookback] LLM failed:", (err as Error).message);
    return null;
  }

  let json = content.trim();
  const fenced = json.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced && fenced[1]) json = fenced[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    console.warn("[lookback] invalid JSON:", content.slice(0, 160));
    return null;
  }

  const validated = lookbackSchema.safeParse(parsed);
  if (!validated.success) {
    // An empty items array is a legitimate "nothing to score", treat as null.
    console.warn("[lookback] output failed schema or was empty");
    return null;
  }
  if (validated.data.items.length === 0) return null;

  return {
    summary: stripBannedChars(validated.data.summary),
    items: validated.data.items.map((it) => ({
      reference: stripBannedChars(it.reference),
      outcome: stripBannedChars(it.outcome),
      verdict: it.verdict,
    })),
  };
}
