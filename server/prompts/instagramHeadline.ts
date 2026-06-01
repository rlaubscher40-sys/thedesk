/**
 * Rewrites a raw feed title into a punchy, human Instagram card headline.
 *
 * Daily feed titles come straight from the source RSS/API, so they are often
 * dataset names or bureaucratic ("Index of Commodity Prices May 2026 - Reserve
 * Bank of Australia"). That reads fine on the website but dies on a social
 * card, where the headline is the only thing that earns the scroll-stop.
 *
 * This runs just-in-time on the 3 stories selected for the daily carousel
 * (not at ingest), so it never touches the website or email copy, and costs
 * ~3 short LLM calls per day. On SKIP or any failure the caller falls back to
 * the original title, so a bad rewrite can never block a post.
 */
import { invokeLLM } from "../core/llm";
import { rubenSystemPrompt, stripBannedChars } from "./voice";

export type InstagramHeadlineInput = {
  title: string;
  summary: string | null;
  category: string;
};

/** Hard cap: above this the rewrite is rejected and the original title used. */
const MAX_HEADLINE_CHARS = 90;

function buildPrompt(input: InstagramHeadlineInput): string {
  return `You are writing the headline for a single Instagram card in The Desk's daily intelligence carousel, read by Australian property and finance professionals.

Raw source title: ${input.title}
Category: ${input.category}
Summary: ${input.summary || "(no summary)"}

Rewrite the raw title into ONE punchy editorial headline that makes someone stop scrolling. The raw title is often a dataset name or a bureaucratic label; your job is to surface the actual story, the implication, or the tension inside it.

Rules:
- 6 to 12 words. Around 70 characters, never more than 90.
- Front-load the hook: the number, the shift, or the "so what". Never lead with the institution's name.
- Stay factually faithful to the summary. Do not invent figures, claims, or causation that is not supported.
- Ruben's voice: calm, commercially sharp, non-obvious. Australian English.
- No em dashes, no question marks, no hype words, no emoji, no trailing punctuation, no quotation marks.
- A headline, not a sentence with a full stop. Title-case or sentence-case, your call, whichever lands harder.

If the raw title is already a sharp, human headline that cannot be meaningfully improved, respond with exactly the literal token SKIP and nothing else.

Output ONLY the rewritten headline, OR the literal token SKIP. No preamble, no quotes, no label.`;
}

/**
 * Rewrite a feed title into an Instagram-card headline. Returns null when the
 * LLM emits SKIP (original is already good), when the output is malformed or
 * too long, or on any error. The caller treats null as "keep the original
 * title", so the post always renders.
 */
export async function generateInstagramHeadline(
  input: InstagramHeadlineInput
): Promise<string | null> {
  try {
    const content = await invokeLLM({
      messages: [
        { role: "system", content: rubenSystemPrompt },
        { role: "user", content: buildPrompt(input) },
      ],
      maxTokens: 200,
    });
    const cleaned = stripBannedChars(content.trim())
      .replace(/^["']|["']$/g, "")
      .replace(/[.\s]+$/, "")
      .trim();
    if (!cleaned) return null;
    if (/^SKIP\.?$/i.test(cleaned)) {
      console.log(`[instagramHeadline] kept original: ${input.title.slice(0, 80)}`);
      return null;
    }
    if (cleaned.length > MAX_HEADLINE_CHARS) {
      console.log(
        `[instagramHeadline] rejected (too long, ${cleaned.length} chars): ${cleaned.slice(0, 80)}`
      );
      return null;
    }
    return cleaned;
  } catch (err) {
    console.error("[instagramHeadline] generation error:", err);
    return null;
  }
}
