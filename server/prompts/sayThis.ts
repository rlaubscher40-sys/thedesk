/**
 * Generates the one-line "Say This" conversation starter stamped on every
 * daily feed item. Distinct from partnerTag (4-line / per-persona), sayThis
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
  return `You are writing for Ruben Laubscher, a property partnerships professional based in Sydney. He uses these lines verbatim in conversations with brokers, advisers and buyer's agents about Australian property, finance, lending, regulation, and adjacent macro / markets stories.

Story: ${input.title}
Category: ${input.category}
Summary: ${input.summary || "(no summary)"}

FIRST, check whether this story is genuinely commercially relevant to the partner channel, property, mortgages, lending, regulation, macro / markets, super, ATO, RBA, APRA, the kind of thing a broker or adviser actually mentions in a client conversation.

If the story is sport, entertainment, lifestyle, celebrity, true crime, weather, or any other beat that has NO real partner-channel angle: respond with exactly the literal token SKIP and nothing else. Do not invent a contrived angle.

Otherwise, write ONE sentence (max 28 words) that:
- Opens a conversation without explaining the news itself
- Lands a sharp commercial insight or implied action
- Reads like something a sharp operator would actually say, not a press release
- Australian English, no em dashes, no question marks, no hashtags

Output ONLY the single line, OR the literal token SKIP. No preamble, no quotes, no attribution.`;
}

/**
 * Generate the one-line sayThis. Returns null when the LLM emits the
 * SKIP token (genuinely off-topic story, no partner-channel angle),
 * when output is malformed, or on any error. The caller treats null
 * as "this story doesn't get a Say This line", which is the right
 * behaviour for trending / off-beat stories that belong in the feed
 * but shouldn't be wrenched into a partner conversation.
 */
export async function generateSayThis(input: SayThisInput): Promise<string | null> {
  try {
    const content = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You write short, commercially sharp conversation openers, OR you respond with the literal token SKIP when a story has no genuine partner-channel angle. Output one or the other, nothing else.",
        },
        { role: "user", content: buildPrompt(input) },
      ],
    });
    const trimmed = content.trim().replace(/^["']|["']$/g, "");
    if (!trimmed || trimmed.length > 280) return null;
    if (/^SKIP\.?$/i.test(trimmed)) {
      console.log(`[sayThis] skipped (off-topic): ${input.title.slice(0, 80)}`);
      return null;
    }
    return trimmed;
  } catch (err) {
    console.error("[sayThis] generation error:", err);
    return null;
  }
}
