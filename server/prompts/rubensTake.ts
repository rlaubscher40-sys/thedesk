/**
 * Generates the 2-4 sentence "Ruben's Take" that opens every weekly edition.
 * Two callers:
 *   - The ingestion endpoint, fired once per new edition.
 *   - The admin "regenerate" button on the EditionReader.
 *
 * Both share this builder so the voice stays identical between runs.
 */
import type { EditionTopic, KeyMetrics } from "../../shared/schemas";
import { invokeLLM } from "../core/llm";
import { rubenSystemPrompt, rubensVoiceSamples, stripBannedChars, voiceRules } from "./voice";

export type RubensTakeInput = {
  weekRange: string;
  topics: EditionTopic[];
  keyMetrics: KeyMetrics | null | undefined;
};

function formatTopics(topics: EditionTopic[]): string {
  return topics
    .slice(0, 5)
    .map((t, i) => `${i + 1}. ${t.title} (${t.category}): ${t.summary}`)
    .join("\n");
}

function formatMetrics(metrics: KeyMetrics | null | undefined): string {
  if (!metrics) return "not provided";
  return Object.entries(metrics)
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

export function buildRubensTakePrompt(input: RubensTakeInput): string {
  return `You are writing "Ruben's Take" for The Desk, a weekly intelligence briefing for property investment professionals curated by Ruben Laubscher, Head of Partnerships at InvestorKit.

This week's edition covers: ${input.weekRange}

Top topics this week:
${formatTopics(input.topics)}

Key market metrics: ${formatMetrics(input.keyMetrics)}

---

${voiceRules}

${rubensVoiceSamples}

---

Write Ruben's Take: 2 to 4 sentences that sound like the opening of a Substack essay.

Rules:
- Opens with a scene, observation, or counterintuitive reframe, NOT a summary of the news
- Short punchy sentences mixed with one longer analytical sentence
- Calm authority. Anti-noise. Anti-certainty-performance.
- The angle should be non-obvious: what does this week's news mean for property investors that most people are missing?
- Ends with a question or an invitation to think further, never a CTA
- Output ONLY the 2-4 sentences. No title, no label, no preamble.`;
}

/** Generate Ruben's Take. Returns the cleaned sentence(s) or throws. */
export async function generateRubensTake(input: RubensTakeInput): Promise<string> {
  const content = await invokeLLM({
    messages: [
      { role: "system", content: rubenSystemPrompt },
      { role: "user", content: buildRubensTakePrompt(input) },
    ],
  });
  const cleaned = stripBannedChars(content);
  if (cleaned.length < 20) {
    throw new Error("Ruben's Take generation returned too little content");
  }
  return cleaned;
}
