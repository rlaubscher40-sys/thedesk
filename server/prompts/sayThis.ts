/**
 * Generates the one-line hook stamped on every daily feed item.
 *
 * This line does more work than any other the site generates: it is the
 * sharpest sentence on the story card, and it is the first line of the daily
 * Instagram caption, which is the ~125 characters someone sees before deciding
 * whether to stop scrolling.
 *
 * It used to be written as a script for Ruben to paste into a message to a
 * broker, which aimed the best sentence on every story at an intermediary who
 * is not the reader. It is now written to the reader directly: the observation
 * that makes the story land, not the news itself.
 *
 * Distinct from the reader angles block, which splits by position (buying,
 * holding, watching); this line is the one that holds for all three. The
 * database column is still `sayThis` for continuity.
 */
import { invokeLLM } from "../core/llm";

export type SayThisInput = {
  title: string;
  summary: string | null;
  category: string;
  articleText?: string | null;
};

/** Hand the model the full article (when scraped) so the opener leans on a
 *  concrete detail from the reporting rather than the headline. */
function articleBlock(articleText: string | null | undefined): string {
  const text = articleText?.trim();
  if (!text) return "";
  return `\n\nFull article text (use a specific detail from this — a figure, a named party, a concrete development — so the line sounds like someone who read the piece, not the headline):\n${text.slice(0, 6000)}\n`;
}

function buildPrompt(input: SayThisInput): string {
  return `You are writing the hook line for a story in The Desk, a daily briefing on Australian property and the markets around it. It is read by people who follow the market closely and have money or a home in it: buying, already holding, or watching to time a move.

This line is the sharpest sentence on the story, and it is the first thing someone sees on social before deciding whether to keep reading. Write it to the reader, not about them.

Story: ${input.title}
Category: ${input.category}
Summary: ${input.summary || "(no summary)"}${articleBlock(input.articleText)}

FIRST, check whether this story genuinely bears on Australian property or the money around it: prices, rates, lending, rents, supply, construction, regulation, tax, and macro or markets where they reach housing.

If the story is sport, entertainment, lifestyle, celebrity, true crime, weather, or any other beat with NO real bearing on that: respond with exactly the literal token SKIP and nothing else. Do not invent a contrived angle to fill the slot.

Otherwise, write ONE sentence (max 28 words) that:
- Says what the story means, without re-reporting what happened
- Lands the non-obvious read, the consequence, or what it changes for someone with money in the market
- Sounds like a sharp person telling you the point over coffee, not a headline and not a pitch
- Never instructs the reader to do something, and never addresses them as a professional with clients
- Australian English, no em dashes, no question marks, no hashtags

Output ONLY the single line, OR the literal token SKIP. No preamble, no quotes, no attribution.`;
}

/**
 * Generate the one-line sayThis. Returns null when the LLM emits the
 * SKIP token (genuinely off-topic story, no bearing on the market),
 * when output is malformed, or on any error. The caller treats null
 * as "this story doesn't get a hook line", which is the right
 * behaviour for trending / off-beat stories that belong in the feed
 * but shouldn't be wrenched into a property angle.
 */
export async function generateSayThis(input: SayThisInput): Promise<string | null> {
  try {
    const content = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You write short, commercially sharp hook lines for readers of a property briefing, OR you respond with the literal token SKIP when a story has no genuine bearing on the property market. Output one or the other, nothing else.",
        },
        { role: "user", content: buildPrompt(input) },
      ],
      maxTokens: 300,
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
