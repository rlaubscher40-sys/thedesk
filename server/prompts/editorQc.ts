/**
 * Second-pass managing editor. Audits a synthesised edition for the kinds
 * of things a real news editor catches on read-through: banned phrases that
 * slipped past the writer's rubric, vague generalities, repeated openings,
 * missing audience hooks, unsupported numerics.
 *
 * Returns a revised SynthesisOutput plus an audit log of what was changed
 * so the pipeline can log it for inspection. The pipeline applies the
 * revision as-is — no diff merging — to keep the contract simple.
 */
import { z } from "zod";
import {
  editionTopicSchema,
  keyMetricsSchema,
  signalsSchema,
  type EditionTopic,
  type KeyMetrics,
  type Signals,
} from "../../shared/schemas";
import type { DateToWatch } from "../db/schema";
import { invokeLLM } from "../core/llm";
import { rubenSystemPrompt, stripBannedChars, voiceRules } from "./voice";

export type SynthesisShape = {
  topics: EditionTopic[];
  signals: Signals;
  keyMetrics: KeyMetrics;
  readingTime: string;
  fullText: string | null;
  marketStress: "low" | "moderate" | "high" | null;
  datesToWatch: DateToWatch[] | null;
};

export type EditorQcReport = {
  approved: boolean;
  /** Bullet-style audit notes describing what changed. Logged, not shown. */
  notes: string[];
  /** The revised edition, post-fixes. Same shape as the input. */
  revised: SynthesisShape;
};

const dateToWatchSchema = z.object({
  label: z.string().min(1).max(48),
  description: z.string().min(1).max(400),
});

const qcSchema = z.object({
  approved: z.boolean(),
  notes: z.array(z.string()).max(40).default([]),
  revised: z.object({
    topics: z.array(editionTopicSchema).min(3).max(7),
    signals: signalsSchema.min(4).max(12),
    keyMetrics: keyMetricsSchema,
    readingTime: z.string().max(32).optional(),
    fullText: z.string().optional().nullable(),
    marketStress: z.enum(["low", "moderate", "high"]).optional().nullable(),
    datesToWatch: z.array(dateToWatchSchema).max(12).optional().nullable(),
  }),
});

function buildPrompt(input: SynthesisShape): string {
  return `You are the MANAGING EDITOR doing a final read-through of a weekly edition before publish. The writer has filed; your job is to catch the things a senior editor catches that a writer misses.

Audit on these specific axes:

1. VOICE — banned phrases that slipped past the writer's rubric:
   - Em dashes (replace with comma or full stop)
   - Hype words: "groundbreaking", "game-changing", "unprecedented", "incredible", "exciting"
   - AI tells: "delve", "navigate", "in today's landscape", "it's worth noting", "robust", "leverage", "seamless", "unlock", "ecosystem"
   - Generic openings: "In a recent development", "As we approach", "It's no secret that"
   - Question marks in titles, summaries or takeaways
   - First-person editorial voice ("I think", "in my view")

2. CLARITY — copy that drifts vague:
   - Sentences that could be sharper. Cut padding adjectives.
   - "Significant", "substantial", "considerable" without a number behind them — either add the number or replace with concrete language.
   - Buried lede in any topic summary.

3. CORRECTNESS — logical and grammatical:
   - Internal contradictions across topics (e.g. one topic says rates held, another assumes a cut)
   - Numbers without sources (replace "around 70%" with "around 70%, per CoreLogic" if the daily-feed input supports it; otherwise weaken to "near 70%")
   - Subject-verb agreement, dangling modifiers.

4. CONSISTENCY:
   - Two topics opening the same way? Vary the opening.
   - Same metric quoted with different units across topics? Pick one.
   - Australian English throughout (colour, behaviour, organisation, realise).

5. AUDIENCE HOOK — every topic MUST have a whyItMatters field that is:
   - Specific to brokers / advisers / buyer's agents / SMSF specialists in Australia
   - One sentence
   - Not a paraphrase of keyTakeaway or summary
   - Not generic ("this matters for the property market") — concrete

If whyItMatters is missing on any topic, write one. If it's generic, rewrite it.

6. STRUCTURE — each topic body must implicitly walk: what happened → why it matters → what to watch → what it means for you. If a topic is missing one of these beats, repair the body.

---

${voiceRules}

---

INPUT EDITION (JSON):

${JSON.stringify(input, null, 2)}

---

Output a SINGLE JSON object matching this exact shape, and NOTHING ELSE:

{
  "approved": true | false,
  "notes": [
    "Topic 2 (PROPERTY): rewrote whyItMatters from generic to broker-specific",
    "Topic 4 (MACRO): removed em dash in body para 3",
    // ... one short note per edit. Empty array if approved with no changes.
  ],
  "revised": { /* the entire input shape, with edits applied */ }
}

Rules for the revised output:
- Keep the topic count and order identical to the input.
- Keep the keyMetrics values unchanged (you're not re-extracting data).
- Preserve all fields. If a topic had a body, return a body. If it had whatToWatch, return whatToWatch.
- Edits should be conservative — fix what's broken, don't rewrite for taste.
- whyItMatters is REQUIRED on every topic in the revised output, even if you had to write it from scratch.
- If the input is already clean, set approved=true, notes=[], and return revised identical to input.
- Output valid JSON only. No trailing commas, no comments, no markdown fences.`;
}

/**
 * Run the QC pass. Throws if the model returns invalid JSON or shape — the
 * caller (pipeline) should catch and fall back to the original synthesis.
 */
export async function runEditorQc(
  input: SynthesisShape
): Promise<EditorQcReport> {
  const content = await invokeLLM({
    messages: [
      { role: "system", content: rubenSystemPrompt },
      { role: "user", content: buildPrompt(input) },
    ],
    // Big budget — the revised output can be as long as the input.
    maxTokens: 12_000,
  });

  let json = content.trim();
  const fenced = json.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced && fenced[1]) json = fenced[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(`editorQc: invalid JSON: ${(err as Error).message}`);
  }

  const validated = qcSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `editorQc: output failed schema: ${JSON.stringify(validated.error.flatten())}`
    );
  }

  const r = validated.data.revised;
  return {
    approved: validated.data.approved,
    notes: validated.data.notes ?? [],
    revised: {
      topics: r.topics.map((t) => ({
        ...t,
        title: stripBannedChars(t.title),
        summary: stripBannedChars(t.summary),
        body: t.body ? stripBannedChars(t.body) : undefined,
        keyTakeaway: t.keyTakeaway ? stripBannedChars(t.keyTakeaway) : undefined,
        whyItMatters: t.whyItMatters ? stripBannedChars(t.whyItMatters) : undefined,
        whatToWatch: t.whatToWatch?.map((s) => stripBannedChars(s)),
        talkingPoints: t.talkingPoints
          ? Object.fromEntries(
              Object.entries(t.talkingPoints).map(([k, v]) => [k, stripBannedChars(v)])
            )
          : undefined,
      })),
      signals: r.signals.map((s) => stripBannedChars(s)),
      keyMetrics: r.keyMetrics,
      readingTime: r.readingTime ?? input.readingTime,
      fullText: r.fullText ? stripBannedChars(r.fullText) : null,
      marketStress: r.marketStress ?? null,
      datesToWatch:
        r.datesToWatch?.map((d) => ({
          label: stripBannedChars(d.label),
          description: stripBannedChars(d.description),
        })) ?? null,
    },
  };
}
