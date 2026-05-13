/**
 * Generates the 4-line partner relevance block stamped on every daily feed
 * item during background enrichment. Each line is one persona's "why this
 * matters" angle.
 */
import { PARTNER_TAG_LABELS, parsePartnerTag } from "../../shared/schemas";
import { invokeLLM } from "../core/llm";

export type PartnerTagInput = {
  title: string;
  summary: string | null;
  existingTag?: string | null;
};

function buildPrompt(input: PartnerTagInput): string {
  return `You are writing partner conversation angles for a property investment intelligence tool used by Ruben Laubscher, Head of Partnerships at InvestorKit (Australia's leading data-driven buyer agency).

Story title: ${input.title}
Summary: ${input.summary || "(no summary)"}
Existing single-persona angle: ${input.existingTag || "(none)"}

Write EXACTLY 4 lines, one per persona, in this format:
${PARTNER_TAG_LABELS[0]}: [one sentence, max 20 words, for corporate employers / HR / salary packaging / financial wellness programs]
${PARTNER_TAG_LABELS[1]}: [one sentence, max 20 words, for mortgage brokers focused on borrowing capacity and lending]
${PARTNER_TAG_LABELS[2]}: [one sentence, max 20 words, for financial advisers and accountants focused on wealth strategy]
${PARTNER_TAG_LABELS[3]}: [one sentence, max 20 words, for buyer's agents and property professionals]

Rules:
- Each line must start with exactly the persona label followed by a colon
- Focus on how this news creates a conversation opportunity or client action
- Be specific and commercially sharp, not generic
- Australian English, no em dashes
- Output ONLY the 4 lines, nothing else`;
}

/**
 * Generate a 4-persona tag. Returns null on any failure (validation,
 * malformed model output, network) so the caller can keep the feed item
 * without an angle block.
 */
export async function generatePartnerTag(input: PartnerTagInput): Promise<string | null> {
  try {
    const content = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a commercially sharp property investment intelligence writer. Output only the requested format.",
        },
        { role: "user", content: buildPrompt(input) },
      ],
    });
    // Re-use the runtime parser to validate all 4 labels arrived.
    if (!parsePartnerTag(content)) {
      console.warn("[partnerTag] missing personas in output:", content.slice(0, 120));
      return null;
    }
    return content;
  } catch (err) {
    console.error("[partnerTag] generation error:", err);
    return null;
  }
}
