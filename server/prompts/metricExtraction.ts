/**
 * News-driven metric extraction. Given a metric description and a handful
 * of recent news article snippets that probably contain the figure, ask
 * the LLM to pull the latest published number.
 *
 * Returns a tight JSON shape `{value, asOf, context}` or null when no
 * confident extraction is possible. The caller upserts the result into
 * daily_metrics.
 */
import { z } from "zod";
import { invokeLLM } from "../core/llm";
import { stripBannedChars } from "./voice";

export type ExtractedMetric = {
  value: string;
  asOf: Date | null;
  context: string | null;
} | null;

const responseSchema = z.object({
  found: z.boolean(),
  value: z.string().nullable(),
  asOf: z.string().nullable(),
  context: z.string().nullable(),
});

function buildPrompt(args: {
  metricLabel: string;
  unit: string | null;
  guidance: string;
  articles: Array<{ title: string; summary: string; source: string; date: string | null }>;
}): string {
  const articleBlock = args.articles
    .slice(0, 6)
    .map(
      (a, i) =>
        `${i + 1}. [${a.source}${a.date ? `, ${a.date}` : ""}] ${a.title}\n   ${a.summary}`
    )
    .join("\n\n");
  return `Extract a single numerical metric from recent news articles.

METRIC: ${args.metricLabel}${args.unit ? ` (in ${args.unit})` : ""}
GUIDANCE: ${args.guidance}

RECENT ARTICLES:
${articleBlock}

Return a SINGLE JSON object matching this exact shape, NOTHING ELSE — no preamble, no markdown fences:

{
  "found": true | false,
  "value": "string representation of the number, e.g. \\"67.2\\" or \\"933,137\\" — null if not found",
  "asOf": "ISO date the figure refers to (YYYY-MM-DD), null if unclear",
  "context": "8-12 word editorial blurb explaining what the figure means, e.g. \\"Preliminary, week ending May 15\\" — null if no clean blurb"
}

Rules:
- Set found:false if the articles don't clearly state the metric value. Better to skip than guess.
- value is just the number string. Strip units, percent signs, currency.
- Australian English. No em dashes.`;
}

export async function extractMetricFromNews(args: {
  metricLabel: string;
  unit: string | null;
  guidance: string;
  articles: Array<{ title: string; summary: string; source: string; date: string | null }>;
}): Promise<ExtractedMetric> {
  if (args.articles.length === 0) return null;
  let content: string;
  try {
    content = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a precise metric-extraction helper. Output only valid JSON matching the requested shape. If unsure, return found:false.",
        },
        { role: "user", content: buildPrompt(args) },
      ],
      maxTokens: 400,
    });
  } catch (err) {
    console.warn(`[extract-metric] LLM failed for ${args.metricLabel}:`, err);
    return null;
  }

  let json = content.trim();
  const fenced = json.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced && fenced[1]) json = fenced[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    console.warn(`[extract-metric] invalid JSON for ${args.metricLabel}:`, content.slice(0, 200));
    return null;
  }

  const validated = responseSchema.safeParse(parsed);
  if (!validated.success || !validated.data.found || !validated.data.value) {
    return null;
  }

  const asOf = validated.data.asOf ? new Date(validated.data.asOf) : null;
  return {
    value: stripBannedChars(validated.data.value),
    asOf: asOf && !Number.isNaN(asOf.getTime()) ? asOf : null,
    context: validated.data.context ? stripBannedChars(validated.data.context) : null,
  };
}
