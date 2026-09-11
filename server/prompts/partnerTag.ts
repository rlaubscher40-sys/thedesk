/**
 * Generates the 3-line reader-angles block stamped on every daily feed item
 * during background enrichment. One line per reader position: Buying, Holding,
 * Watching.
 *
 * These replaced three partner roles (Broker / Adviser / Buyers Agent), which
 * were inherited from an earlier life of this codebase as an internal briefing
 * tool. A reader of The Desk is not an intermediary with a client book; they
 * have money or a home in the market themselves, and where they stand in
 * relation to it is what changes what a story means to them.
 *
 * The file and column names still say "partnerTag" for continuity with stored
 * data. Rows written before the change carry the old labels and no longer
 * parse, so the block does not render on them, which is the intended outcome:
 * there is no honest mapping from "Broker" to a reader position.
 */
import { READER_ANGLE_LABELS, parseReaderAngles } from "../../shared/schemas";
import { invokeLLM } from "../core/llm";
import { editorialTimeContext, validEditorialAngle } from "../../shared/editorialTiming";

export type PartnerTagInput = {
  title: string;
  summary: string | null;
  existingTag?: string | null;
  articleText?: string | null;
};

/** Give the model the full article so each persona angle can hook into a
 *  concrete detail from the reporting instead of the headline. */
function articleBlock(articleText: string | null | undefined): string {
  const text = articleText?.trim();
  if (!text) return "";
  return `\n\nFull article text (each persona angle should hook into a specific detail from this — a figure, a rule change, a named development — not the generic headline):\n${text.slice(0, 6000)}\n`;
}

function buildPrompt(input: PartnerTagInput): string {
  return `You are writing the reader-angles block for The Desk, a daily briefing on Australian property and the markets around it. Its readers have money or a home in the market. Where they stand in relation to it is what changes what a story means to them.

Story title: ${input.title}
Summary: ${input.summary || "(no summary)"}
Existing single angle: ${input.existingTag || "(none)"}${articleBlock(input.articleText)}

FIRST, check whether this story genuinely bears on Australian property or the money around it: prices, rates, lending, rents, supply, construction, regulation, tax, and macro or markets where they reach housing. If the story is sport, entertainment, lifestyle, celebrity, true crime, weather, or any other beat with NO real bearing on that: respond with exactly the literal token SKIP and nothing else. Do not invent a contrived angle just to fill three lines.

Otherwise, write EXACTLY 3 lines, one per reader position, in this format:
${READER_ANGLE_LABELS[0]}: [one sentence, max 20 words, for someone actively trying to buy: what it changes about price, competition, borrowing power or timing]
${READER_ANGLE_LABELS[1]}: [one sentence, max 20 words, for someone who already owns: what it changes about repayments, rent, equity or the value of what they hold]
${READER_ANGLE_LABELS[2]}: [one sentence, max 20 words, for someone watching to time a move: what signal this is, and what would confirm it]

Rules:
- Each line must start with exactly the position label followed by a colon
- Say what the story changes for that reader. Do not tell them what to do, and never address them as a professional with clients
- The three lines must genuinely differ. If a story lands the same way for all three, say the same thing three different ways is a failure: find what is actually different, or SKIP
- Be specific and concrete, not generic
- Australian English, no em dashes
- Output ONLY the 3 lines, OR the literal token SKIP. Nothing else.`;
}

/**
 * Generate a 4-persona tag. Returns null when:
 *   - the LLM emits the SKIP token (genuinely off-topic story, the
 *     story stays in the feed but doesn't get reader angles forced
 *     onto it)
 *   - the response is malformed (missing labels)
 *   - any error (network, validation)
 *
 * The caller treats null as "this story doesn't get reader angles",
 * which is the right behaviour for trending / off-beat stories.
 */
export async function generatePartnerTag(input: PartnerTagInput): Promise<string | null> {
  try {
    const content = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a commercially sharp writer for a briefing on Australian property. Output the 3-line reader-angles block OR the literal token SKIP when the story has no genuine bearing on the property market.",
        },
        { role: "user", content: `${editorialTimeContext()}\n\n${buildPrompt(input)}` },
      ],
      maxTokens: 600,
    });
    const trimmed = content.trim();
    if (/^SKIP\.?$/i.test(trimmed)) {
      console.log(`[partnerTag] skipped (off-topic): ${input.title.slice(0, 80)}`);
      return null;
    }
    // Re-use the runtime parser to validate all 4 labels arrived.
    if (!parseReaderAngles(content)) {
      console.warn("[partnerTag] missing personas in output:", content.slice(0, 120));
      return null;
    }
    return validEditorialAngle(content);
  } catch (err) {
    console.error("[partnerTag] generation error:", err);
    return null;
  }
}
