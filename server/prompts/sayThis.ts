/**
 * Generates the one-line "Say This" conversation starter stamped on every
 * daily feed item. Distinct from partnerTag (4-line / per-persona) — sayThis
 * is the universal, single-sentence opener Ruben can paste straight into a
 * client message or LinkedIn comment.
 */
import { invokeLLM } from "../core/llm";

export type SayThisInput = {
  title: string;
  summary: string | null;
  category: string;
};

function buildPrompt(input: SayThisInput): string {
  return `You are writing for Ruben Laubscher, Head of Partnerships at InvestorKit (Australia's leading data-driven buyer agency). He uses these lines verbatim in conversations with brokers, advisers and buyer's agents.

Story: ${input.title}
Category: ${input.category}
Summary: ${input.summary || "(no summary)"}

Write ONE sentence (max 28 words) that:
- Opens a conversation without explaining the news itself
- Lands a sharp commercial insight or implied action
- Reads like something a sharp operator would actually say, not a press release
- Australian English, no em dashes, no question marks, no hashtags

Output ONLY the single line. No preamble, no quotes, no attribution.`;
}

/**
 * Generate the one-line sayThis. Returns null on any failure so the caller
 * can leave the field empty and try again later.
 */
export async function generateSayThis(input: SayThisInput): Promise<string | null> {
  try {
    const content = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You write short, commercially sharp conversation openers. Output only the requested single line.",
        },
        { role: "user", content: buildPrompt(input) },
      ],
    });
    const trimmed = content.trim().replace(/^["']|["']$/g, "");
    if (!trimmed || trimmed.length > 280) return null;
    return trimmed;
  } catch (err) {
    console.error("[sayThis] generation error:", err);
    return null;
  }
}
