/**
 * Generates the full Substack essay draft (title, subtitle, body) and a hero
 * image prompt for a weekly edition. Split into builder + generator so tests
 * and admin tooling can inspect the prompt without hitting the LLM.
 */
import { substackDraftSchema, type EditionTopic, type KeyMetrics, type SubstackDraft } from "../../shared/schemas";
import { invokeLLM } from "../core/llm";
import { rubenSystemPrompt, rubensVoiceSamples, stripBannedChars, voiceRules } from "./voice";

export type SubstackDraftInput = {
  weekRange: string;
  topics: EditionTopic[];
  keyMetrics: KeyMetrics | null | undefined;
  rubensTake: string | null | undefined;
};

const SUBSTACK_CTA =
  '"If this landed, I write two of these a week. Subscribe and I\'ll send them straight to your inbox."';

function formatTopics(topics: EditionTopic[]): string {
  return topics
    .slice(0, 5)
    .map((t, i) =>
      [
        `${i + 1}. ${t.title} (${t.category})`,
        `   Summary: ${t.summary}`,
        t.body ? `   Analysis: ${t.body.slice(0, 300)}` : "",
        t.keyTakeaway ? `   Key takeaway: ${t.keyTakeaway}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
}

function formatMetrics(metrics: KeyMetrics | null | undefined): string {
  if (!metrics) return "not provided";
  return Object.entries(metrics)
    .slice(0, 6)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

export function buildSubstackDraftPrompt(input: SubstackDraftInput): string {
  return `You are ghostwriting a Substack essay for Ruben Laubscher. Ruben is 25, a property partnerships professional based in Sydney, building his partnerships practice from scratch since 2026. Based in Sydney. He writes about leadership, property investment, and the decisions that compound.

This essay is based on his weekly intelligence edition: ${input.weekRange}

Ruben's Take (editorial hook, already written by Ruben): ${input.rubensTake || "(not yet written, write your own scene-setting opener)"}

Top topics from this edition:
${formatTopics(input.topics)}

Key market metrics: ${formatMetrics(input.keyMetrics)}

---

${voiceRules}

${rubensVoiceSamples}

---

Substack closing CTA (always end the essay with this exact line in italics):
${SUBSTACK_CTA}

ESSAY STRUCTURE (600-800 words):

1. Opening (2-3 sentences): Use Ruben's Take if provided, or write a specific scene-setting moment. NEVER open with the lesson or a summary of the news.
2. The Signal (1 paragraph): What is the most important thing happening in property markets right now that most people are missing or misreading?
3. What it means (2 paragraphs): Unpack the implications. Be specific. Reference the actual data from this edition. Connect to what investors and advisers should actually be doing.
4. The pattern (1 paragraph): Connect this week to a longer trend. What does someone who has been watching markets for years see that others don't?
5. Closing (1 paragraph in italics): A question or observation that invites the reader to think further. Then the subscriber CTA on a new line.

Section breaks between sections use --- on its own line.

Also provide:
- A title: short, punchy, often a reframe or a tension. Like "The Fear Trade", "Same Objection, Different Person", "The Things You Stop Doing First", "The 3-Day Decision That Cost Me $230K". Never a question. Never clickbait.
- A subtitle: one plain sentence that frames the angle.

Output as JSON with keys: title, subtitle, body (the full essay as plain text with paragraph breaks as \\n\\n and section breaks as \\n\\n---\\n\\n)`;
}

/** Generate a Substack draft. Throws if the LLM returns invalid JSON or fails validation. */
export async function generateSubstackDraft(input: SubstackDraftInput): Promise<SubstackDraft> {
  const content = await invokeLLM({
    messages: [
      { role: "system", content: rubenSystemPrompt },
      { role: "user", content: buildSubstackDraftPrompt(input) },
    ],
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "substack_draft",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            subtitle: { type: "string" },
            body: { type: "string" },
          },
          required: ["title", "subtitle", "body"],
          additionalProperties: false,
        },
      },
    },
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Substack draft: LLM returned invalid JSON");
  }
  const draft = substackDraftSchema.parse(parsed);
  return {
    title: stripBannedChars(draft.title),
    subtitle: stripBannedChars(draft.subtitle),
    body: stripBannedChars(draft.body),
  };
}
