/**
 * Rewrites a raw feed title into a punchy, human Instagram card headline.
 *
 * Daily feed titles come straight from the source RSS/API, so they are often
 * dataset names or bureaucratic ("Index of Commodity Prices May 2026 - Reserve
 * Bank of Australia"). That reads fine on the website but dies on a social
 * card, where the headline is the only thing that earns the scroll-stop.
 *
 * This runs just-in-time on the 3 stories selected for the daily carousel
 * (not at ingest), so it never touches the website or email copy. On SKIP or
 * any failure the caller falls back to the original title, so a bad rewrite
 * can never block a post.
 */
import { invokeLLM } from "../core/llm";
import { rubenSystemPrompt, stripBannedChars } from "./voice";

export type InstagramHeadlineInput = {
  title: string;
  summary: string | null;
  category: string;
};

/** The grid has to read in a glance. Longer outputs fall back to source copy. */
const MAX_HEADLINE_CHARS = 82;

function numericClaims(value: string): string[] {
  return [...value.matchAll(/\d[\d,.]*(?:\.\d+)?%?/g)].map((match) =>
    match[0].replace(/,/g, "").toLowerCase()
  );
}

/**
 * A social rewrite is allowed to compress language, never invent a number.
 * This deterministic check sits after the model so the highest-attention
 * surface in the product cannot create a fabricated price, percentage or count.
 */
export function instagramHeadlineNumbersAreGrounded(
  headline: string,
  input: InstagramHeadlineInput
): boolean {
  const outputNumbers = numericClaims(headline);
  if (outputNumbers.length === 0) return true;
  const sourceNumbers = new Set(numericClaims(`${input.title} ${input.summary ?? ""}`));
  return outputNumbers.every((value) => sourceNumbers.has(value));
}

function buildPrompt(input: InstagramHeadlineInput): string {
  return `You are writing the scroll-stopping first line for one card in The Desk, an Australian property intelligence publication.

Raw source title: ${input.title}
Category: ${input.category}
Summary: ${input.summary || "(no summary)"}

The job is not to summarise the article. Find the SINGLE concrete thing someone would repeat to another person: the number, reversal, record, gap, constraint or consequence. Make that the headline.

Rules:
- 4 to 10 words. Aim for 45 to 72 characters, never more than 82.
- If the source contains a genuinely striking number that carries the story, lead with that exact number.
- Preserve every figure exactly. Never calculate, round, extrapolate or invent a figure.
- Prefer a concrete claim over generic words like "outlook", "update", "trend", "market" or "report".
- Never lead with the institution, publisher, survey or dataset name unless that institution itself is the story.
- Stay factually faithful to the supplied title and summary. Do not add causation that is not explicit.
- Calm, commercially sharp, specific. Australian English.
- No clickbait, em dashes, question marks, emoji, quotation marks, hashtags or trailing full stop.
- It should look good alone on a dark card in very large type.

Good shape: "21,465 people left NSW"
Good shape: "$1.66B wiped from asking prices"
Weak shape: "Property market faces another major shift"
Weak shape: "New report reveals surprising housing trend"

If the source is too vague to improve safely, respond with exactly SKIP.

Output ONLY the rewritten headline or SKIP.`;
}

/**
 * Rewrite a feed title into an Instagram-card headline. Returns null when the
 * LLM emits SKIP, the output is malformed/too long, a numeric claim cannot be
 * traced back to the source text, or on any error. The caller treats null as
 * "keep the original title", so social generation fails closed.
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
      maxTokens: 160,
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
    if (!instagramHeadlineNumbersAreGrounded(cleaned, input)) {
      console.warn(`[instagramHeadline] rejected ungrounded numeric rewrite: ${cleaned}`);
      return null;
    }
    return cleaned;
  } catch (err) {
    console.error("[instagramHeadline] generation error:", err);
    return null;
  }
}
