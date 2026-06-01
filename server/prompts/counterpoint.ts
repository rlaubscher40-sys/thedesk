/**
 * Generates the one-line "Counterpoint" stamped on daily feed items that have
 * a genuine second side. Where whyItMatters states the consensus implication,
 * the counterpoint names the tension the consensus is glossing over: the bear
 * case, the thing that could go wrong, the reason the obvious read might be
 * wrong. It is deliberately optional, most stories return SKIP, so the line
 * only appears where there is real analytical tension worth flagging. This
 * matches Ruben's voice: calm, refuses to perform certainty.
 */
import { invokeLLM } from "../core/llm";

export type CounterpointInput = {
  title: string;
  summary: string | null;
  category: string;
  articleText?: string | null;
};

function articleBlock(articleText: string | null | undefined): string {
  const text = articleText?.trim();
  if (!text) return "";
  return `\n\nFull article text (mine it for the tension the headline smooths over):\n${text.slice(0, 6000)}\n`;
}

function buildPrompt(input: CounterpointInput): string {
  return `You are writing the "Counterpoint" line for a daily intelligence feed read by property and finance professionals (brokers, advisers, accountants, buyer's agents) in Australia.

Story: ${input.title}
Category: ${input.category}
Summary: ${input.summary || "(no summary)"}${articleBlock(input.articleText)}

Write ONE sentence (max 28 words) that names the non-obvious tension in this story: the bear case, the second-order risk, the assumption the consensus is making that might be wrong, or the reason the obvious read could disappoint. It is the calm contrarian read, not a hot take, and not a recap.

Rules:
- State the tension or risk, grounded in something specific, not vague hedging
- It must genuinely complicate the obvious interpretation, not just restate it with a "but"
- Australian English, no em dashes, no question marks, no hashtags
- Calm and analytical, never alarmist

Most stories do NOT have a real counterpoint worth making. If this story is one-sided, purely factual, or any contrarian angle would be contrived: respond with exactly the literal token SKIP and nothing else. Be willing to SKIP often, a forced counterpoint is worse than none.

Output ONLY the single line, OR the literal token SKIP. No preamble, no quotes, no label.`;
}

/**
 * Generate the one-line counterpoint. Returns null when the LLM emits SKIP
 * (no genuine second side, which is the common case), when output is
 * malformed, or on any error. The caller treats null as "no counterpoint
 * line", and the card simply omits it.
 */
export async function generateCounterpoint(
  input: CounterpointInput
): Promise<string | null> {
  try {
    const content = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You write sharp, calm, one-sentence counterpoints that name the tension a news story glosses over, OR you respond with the literal token SKIP when a story has no genuine second side. Output one or the other, nothing else.",
        },
        { role: "user", content: buildPrompt(input) },
      ],
    });
    const trimmed = content.trim().replace(/^["']|["']$/g, "");
    if (!trimmed || trimmed.length > 280) return null;
    if (/^SKIP\.?$/i.test(trimmed)) {
      console.log(`[counterpoint] skipped (no second side): ${input.title.slice(0, 80)}`);
      return null;
    }
    return trimmed;
  } catch (err) {
    console.error("[counterpoint] generation error:", err);
    return null;
  }
}
