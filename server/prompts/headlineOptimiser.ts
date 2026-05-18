/**
 * Generates SEO-tuned meta tags + three alternative web headlines for an
 * edition. Runs after the synthesis + editor-QC passes, i.e. on a clean
 * edition. Cheap (~one short LLM call) and the output is stored on the
 * edition row so the admin can swap or A/B later.
 */
import { z } from "zod";
import type { EditionTopic } from "../../shared/schemas";
import { invokeLLM } from "../core/llm";
import { stripBannedChars, voiceRules } from "./voice";

export type HeadlineOptimiserInput = {
  weekRange: string;
  rubensTake: string | null;
  topics: EditionTopic[];
  fullText: string | null;
};

export type HeadlineOptimiserOutput = {
  metaTitle: string;
  metaDescription: string;
  socialTitle: string;
  socialDescription: string;
  headlineVariants: string[];
};

const schema = z.object({
  metaTitle: z.string().min(10).max(150),
  metaDescription: z.string().min(40).max(300),
  socialTitle: z.string().min(10).max(190),
  socialDescription: z.string().min(40).max(380),
  headlineVariants: z.array(z.string().min(8).max(140)).min(2).max(5),
});

function buildPrompt(input: HeadlineOptimiserInput): string {
  const topicLines = input.topics
    .slice(0, 6)
    .map((t, i) => `  ${i + 1}. [${t.category}] ${t.title}, ${t.summary}`)
    .join("\n");

  return `You are optimising the headline + share metadata for a weekly edition of The Desk.

The Desk is a daily / weekly intelligence brief for Australian property investment professionals, brokers, advisers, accountants, buyer's agents, SMSF specialists. Editorially serious, plain-spoken, commercially sharp. Curated by Ruben Laubscher (Head of Partnerships, InvestorKit).

Week: ${input.weekRange}

Lead editorial line (Ruben's Take):
${input.rubensTake ?? "(none provided)"}

Topics in this edition:
${topicLines}

${input.fullText ? `Editor's letter excerpt (first 400 chars):\n${input.fullText.slice(0, 400)}\n` : ""}

---

${voiceRules}

---

Produce metadata optimised for these distinct surfaces:

1. metaTitle, Google search results. 50-60 chars sweet spot, 70 max. Front-loads the most clickable keyword. Names the edition by its argument, not its number.

2. metaDescription, Google meta description. 145-160 chars. One sentence that promises the read. Not a recap, a hook.

3. socialTitle, LinkedIn / Twitter / Slack card. 60-70 chars. Punchier than metaTitle; can be more opinionated. Still no question marks, still no hype words.

4. socialDescription, social card subtitle. 180-200 chars. Two short sentences. Establishes credibility (mention the week's standout data point) AND curiosity (what the read uncovers).

5. headlineVariants, three alternative web headlines for the edition page itself. Each 8-14 words. Each takes a different angle: one names the data point, one names the implication, one frames the question the reader brought. Specific, not generic.

Output a SINGLE JSON object, NOTHING ELSE:

{
  "metaTitle": "...",
  "metaDescription": "...",
  "socialTitle": "...",
  "socialDescription": "...",
  "headlineVariants": ["...", "...", "..."]
}

Rules:
- Ruben's voice. No em dashes, no question marks in titles, no hype words.
- Australian English.
- Numbers and proper nouns earn their place. No padding adjectives.
- Output valid JSON only.`;
}

export async function optimiseHeadlines(
  input: HeadlineOptimiserInput
): Promise<HeadlineOptimiserOutput> {
  const content = await invokeLLM({
    messages: [{ role: "user", content: buildPrompt(input) }],
    maxTokens: 1_500,
  });

  let json = content.trim();
  const fenced = json.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced && fenced[1]) json = fenced[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(`headlineOptimiser: invalid JSON: ${(err as Error).message}`);
  }

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `headlineOptimiser: output failed schema: ${JSON.stringify(validated.error.flatten())}`
    );
  }

  return {
    metaTitle: stripBannedChars(validated.data.metaTitle),
    metaDescription: stripBannedChars(validated.data.metaDescription),
    socialTitle: stripBannedChars(validated.data.socialTitle),
    socialDescription: stripBannedChars(validated.data.socialDescription),
    headlineVariants: validated.data.headlineVariants.map((v) => stripBannedChars(v)),
  };
}
