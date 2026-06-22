/**
 * Generates the one-line "In Brief" subtext for a coverage-lane story on an
 * Instagram card (Tech / Business / Global — the "Wider Lens" carousel).
 *
 * Why this exists separately from `whyItMatters`:
 *   - The finance "why it matters" generator SKIPs general news, which thinned
 *     the coverage carousel below three slides.
 *   - The previous workaround reprinted the publisher's summary verbatim onto
 *     the card. That republishes uncleared source copy to a public feed, which
 *     we don't want.
 *
 * This generator instead writes The Desk's OWN one-sentence brief: an original
 * paraphrase of what the story is and why it's worth a glance, in our editorial
 * voice, explicitly NOT reusing the publisher's phrasing. Facts aren't
 * copyrightable; the source's expression is — so we keep the facts and write
 * our own sentence.
 */
import { invokeLLM } from "../core/llm";

export type CoverageBriefInput = {
  title: string;
  summary: string | null;
  category: string;
};

function buildPrompt(input: CoverageBriefInput): string {
  return `You are writing the one-line "In Brief" caption for a news card on The Desk's "Wider Lens" feed (general Tech, Business and Global stories).

Story: ${input.title}
Category: ${input.category}
Source summary (for facts only — do NOT reuse its wording): ${input.summary || "(no summary)"}

Write ONE original sentence (max 28 words) that tells the reader what this story is and why it's worth a look. Paraphrase the facts in your own words — this must NOT echo or lightly reword the source summary's phrasing; write a genuinely fresh sentence as if briefing a colleague from memory.

Rules:
- Original wording only; never copy distinctive phrases from the source summary
- Lead with the substance (what happened / what's at stake), not "this story covers..."
- Concrete and specific; no vague filler like "this could have implications"
- Australian English, no em dashes, no question marks, no hashtags
- Neutral editorial register, not a sales pitch

Output ONLY the single sentence. No preamble, no quotes, no label.`;
}

/**
 * Generate the original one-line coverage brief. Returns null on malformed
 * output or any error; the caller then drops the story from the carousel rather
 * than render a blank card. Unlike `generateWhyItMatters` this never emits SKIP
 * — coverage lanes are general news by design, so we always attempt a line.
 */
export async function generateCoverageBrief(
  input: CoverageBriefInput
): Promise<string | null> {
  try {
    const content = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You write sharp, original one-sentence news briefs in your own words. You never copy or lightly reword the wording you are given — you restate the facts freshly. Output one sentence, nothing else.",
        },
        { role: "user", content: buildPrompt(input) },
      ],
    });
    const trimmed = content.trim().replace(/^["']|["']$/g, "");
    if (!trimmed || trimmed.length > 320) return null;
    if (/^SKIP\.?$/i.test(trimmed)) return null;
    return trimmed;
  } catch (err) {
    console.error("[coverageBrief] generation error:", err);
    return null;
  }
}
