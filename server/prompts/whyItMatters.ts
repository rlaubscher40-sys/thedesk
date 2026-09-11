/**
 * Generates the one-line "Why it matters" context note stamped on every
 * daily feed item. This is the analytical bridge between the raw summary
 * (what happened) and the sayThis line (what to say to a client):
 *
 *   summary       , the lede, what happened
 *   whyItMatters  , the so-what, the implication or thing to watch for
 *   sayThis       , the hook, the sharpest line, written to the reader
 *
 * The goal is full context in a single scan: a reader skimming the Today
 * feed should grasp the stakes of a story without clicking through or
 * already knowing the background.
 */
import { invokeLLM } from "../core/llm";
import { editorialTimeContext, validEditorialAngle } from "../../shared/editorialTiming";

export type WhyItMattersInput = {
  title: string;
  summary: string | null;
  category: string;
  articleText?: string | null;
};

/** When the full article body is available, hand it to the model and tell it
 *  to mine the buried specific (a number, a named party, a second-order
 *  effect) rather than working from the headline alone. */
function articleBlock(articleText: string | null | undefined): string {
  const text = articleText?.trim();
  if (!text) return "";
  return `\n\nFull article text (mine this for the specific detail the headline buries — a figure, a named party, a stated consequence — and ground your line in it):\n${text.slice(0, 6000)}\n`;
}

function buildPrompt(input: WhyItMattersInput): string {
  return `You are writing the "Why it matters" line for The Desk, a daily briefing on Australian property and the markets around it. Its readers follow the market closely and have money or a home in it: buying, already holding, or watching to time a move. They are not industry professionals working a client book.

Story: ${input.title}
Category: ${input.category}
Summary: ${input.summary || "(no summary)"}${articleBlock(input.articleText)}

Write ONE sentence (max 30 words) that explains why this story matters — the implication, the second-order consequence, or the specific thing to watch for next. This is NOT a summary of what happened (the reader already has that) and NOT a conversation script. It is the analytical "so what" that lets someone grasp the stakes in a single scan.

Rules:
- State the consequence, signal, or what to watch — not a recap of the headline
- Where the full article text is provided, anchor your line in a specific detail from it, not the generic headline takeaway
- Be concrete and specific; avoid vague phrasing like "this could have implications"
- Australian English, no em dashes, no question marks, no hashtags
- Neutral analytical register, not a sales pitch, and never an instruction to the reader

If the story is genuinely trivial with no broader significance (pure celebrity gossip, sport scores, weather): respond with exactly the literal token SKIP and nothing else.

Output ONLY the single line, OR the literal token SKIP. No preamble, no quotes, no label.`;
}

/**
 * Generate the one-line whyItMatters. Returns null when the LLM emits the
 * SKIP token (genuinely trivial story), when output is malformed, or on
 * any error. The caller treats null as "this story doesn't get a context
 * note", which is fine — the card simply omits the line.
 */
export async function generateWhyItMatters(input: WhyItMattersInput): Promise<string | null> {
  try {
    const content = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You write sharp, one-sentence analytical context notes that explain why a news story matters, OR you respond with the literal token SKIP when a story is genuinely trivial. Output one or the other, nothing else.",
        },
        { role: "user", content: `${editorialTimeContext()}\n\n${buildPrompt(input)}` },
      ],
      maxTokens: 300,
    });
    const trimmed = content.trim().replace(/^["']|["']$/g, "");
    if (!trimmed || trimmed.length > 320) return null;
    if (/^SKIP\.?$/i.test(trimmed)) {
      console.log(`[whyItMatters] skipped (trivial): ${input.title.slice(0, 80)}`);
      return null;
    }
    return validEditorialAngle(trimmed);
  } catch (err) {
    console.error("[whyItMatters] generation error:", err);
    return null;
  }
}
