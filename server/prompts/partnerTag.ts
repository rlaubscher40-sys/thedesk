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
  return `You are writing partner conversation angles for a property investment intelligence tool used by Ruben Laubscher, Head of Partnerships at InvestorKit (Australia's leading data-driven buyer agency). The audience is brokers, advisers, accountants and buyer's agents in Australian property and finance.

Story title: ${input.title}
Summary: ${input.summary || "(no summary)"}
Existing single-persona angle: ${input.existingTag || "(none)"}

FIRST, check whether this story has genuine partner-channel relevance, property, lending, regulation, macro / markets, super, ATO, RBA, APRA, broker / adviser workflows. If the story is sport, entertainment, lifestyle, celebrity, true crime, weather, or any other beat with NO real partner-channel hook: respond with exactly the literal token SKIP and nothing else. Do not invent a contrived angle just to fill four lines.

Otherwise, write EXACTLY 4 lines, one per persona, in this format:
${PARTNER_TAG_LABELS[0]}: [one sentence, max 20 words, for corporate employers / HR / salary packaging / financial wellness programs]
${PARTNER_TAG_LABELS[1]}: [one sentence, max 20 words, for mortgage brokers focused on borrowing capacity and lending]
${PARTNER_TAG_LABELS[2]}: [one sentence, max 20 words, for financial advisers and accountants focused on wealth strategy]
${PARTNER_TAG_LABELS[3]}: [one sentence, max 20 words, for buyer's agents and property professionals]

Rules:
- Each line must start with exactly the persona label followed by a colon
- Focus on how this news creates a conversation opportunity or client action
- Be specific and commercially sharp, not generic
- Australian English, no em dashes
- Output ONLY the 4 lines, OR the literal token SKIP. Nothing else.`;
}

/**
 * Generate a 4-persona tag. Returns null when:
 *   - the LLM emits the SKIP token (genuinely off-topic story, the
 *     story stays in the feed but doesn't get partner angles forced
 *     onto it)
 *   - the response is malformed (missing labels)
 *   - any error (network, validation)
 *
 * The caller treats null as "this story doesn't get partner angles",
 * which is the right behaviour for trending / off-beat stories.
 */
export async function generatePartnerTag(input: PartnerTagInput): Promise<string | null> {
  try {
    const content = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a commercially sharp property investment intelligence writer. Output the 4-line partner angle block OR the literal token SKIP when there is no genuine partner-channel angle.",
        },
        { role: "user", content: buildPrompt(input) },
      ],
    });
    const trimmed = content.trim();
    if (/^SKIP\.?$/i.test(trimmed)) {
      console.log(`[partnerTag] skipped (off-topic): ${input.title.slice(0, 80)}`);
      return null;
    }
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
