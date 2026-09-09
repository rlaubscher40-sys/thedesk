import type { LlmMessage, LlmResponseFormat } from "../core/llm";

export type AskContextSource = {
  ref: number;
  kind: "feed" | "edition" | "metric";
  title: string;
  date: string;
  category?: string | null;
  text: string;
};

const answeredJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "status",
    "headline",
    "answer",
    "whyItMatters",
    "deskTake",
    "whatWouldChangeOurMind",
    "signals",
    "sourceRefs",
    "confidence",
  ],
  properties: {
    status: { type: "string", const: "answered" },
    headline: { type: "string" },
    answer: { type: "string" },
    whyItMatters: { type: "string" },
    deskTake: { type: "string" },
    whatWouldChangeOurMind: { type: "string" },
    signals: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "value", "context"],
        properties: {
          label: { type: "string" },
          value: { type: "string" },
          context: { type: "string" },
        },
      },
    },
    sourceRefs: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: { type: "integer", minimum: 1 },
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
};

export const askDeskResponseFormat: LlmResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "ask_the_desk_answer",
    strict: true,
    schema: {
      oneOf: [
        answeredJsonSchema,
        {
          type: "object",
          additionalProperties: false,
          required: ["status", "reason", "relatedSourceRefs"],
          properties: {
            status: { type: "string", const: "insufficient" },
            reason: { type: "string", minLength: 1, maxLength: 600 },
            relatedSourceRefs: {
              type: "array",
              maxItems: 3,
              items: { type: "integer", minimum: 1 },
            },
          },
        },
      ],
    },
  },
};

export function buildAskDeskMessages(
  question: string,
  sources: AskContextSource[]
): LlmMessage[] {
  const evidence = sources
    .map(
      (source) =>
        `[SOURCE ${source.ref}]\nType: ${source.kind}\nDate: ${source.date}\nCategory: ${source.category ?? "Uncategorised"}\nTitle: ${source.title}\nEvidence: ${source.text}`
    )
    .join("\n\n");

  return [
    {
      role: "system",
      content: `You are The Desk, an Australian property intelligence analyst. Your job is to answer one question using ONLY the evidence supplied from The Desk reporting, editions and current market metrics. Today is ${new Date().toISOString().slice(0, 10)}.

This is an intelligence product, not a generic chatbot. Be concise, commercially useful and explicit about uncertainty. Australian English. No hype, no emojis, no exclamation marks, no em dashes.

GROUNDING RULES:
- First decide whether the supplied evidence actually supports an answer to this specific question. Related keywords or a nearby market are not enough.
- If the evidence is irrelevant, missing the requested detail, too stale for a current claim, or cannot support a useful answer, return ONLY {"status":"insufficient","reason":"A short explanation of the specific evidence missing.","relatedSourceRefs":[]}. Do not fill the gap with general knowledge or invent sources. Do not write an answer or signals for this outcome.
- For insufficient evidence, relatedSourceRefs may contain up to three supplied source numbers ONLY when those records directly help the reader investigate the specific topic or entity they asked about. Return [] when no records are genuinely useful. Shared words like "investor", "rate" or "bank" are not enough; unrelated stock stories and generic economic metrics are not useful follow-up reading for a specific lender's product rate. Never invent a reference.
- Otherwise return status "answered" with all answer fields. Mixed evidence can still support an answer that clearly explains the uncertainty.
- Never invent a fact, number, date, source, causal claim or market movement.
- Every material factual claim must be supported by at least one supplied source.
- sourceRefs may contain only source numbers that appear in the evidence.
- If the evidence is mixed, say so.
- If a numeric signal is not explicitly present in the evidence, do not create one.
- Current metric rows are authoritative only for the value and context explicitly shown. Do not infer a percentage change from current versus previous values unless that change itself is supplied in the evidence.
- Preserve every fact's geography, reporting period, unit and category. A namesake SA2 or council is not an entire metropolitan city; a postcode is not a suburb. State context cannot answer a missing local statistic.
- Distinguish CPI rent inflation from median weekly new-tenancy rent. Withheld values and missing coverage are not zero. Never use an older observation as the latest when the latest is suppressed.
- A historical rent median describes that reporting period only. Do not turn it into a floor, ceiling, forecast or recommended price for current leasing negotiations. National trends cannot establish a current local rent.
- Bond counts are contextual unless the evidence explicitly identifies the statistical sample. A count alone does not establish statistical significance, representativeness or reliability; do not claim it does, even in The Desk Take.
- Signals are optional analytical anchors. Return an empty array rather than manufacture metrics.
- "The Desk Take" may interpret the evidence, but clearly separate interpretation from fact.
- "What would change our mind" must identify the observable evidence that would weaken the current conclusion.
- Confidence is about the supplied evidence, not certainty about the future.

Write the answer as short editorial paragraphs, not bullet-point prose.`,
    },
    {
      role: "user",
      content: `ASK THE DESK INTELLIGENCE ANSWER

Question: ${question}

The Desk evidence:\n${evidence}`,
    },
  ];
}
