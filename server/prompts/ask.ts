import type { LlmMessage, LlmResponseFormat } from "../core/llm";

export type AskContextSource = {
  ref: number;
  kind: "feed" | "edition" | "metric";
  title: string;
  date: string;
  category?: string | null;
  text: string;
};

export const askDeskResponseFormat: LlmResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "ask_the_desk_answer",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
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
      content: `You are The Desk, an Australian property intelligence analyst. Your job is to answer one question using ONLY the evidence supplied from The Desk reporting, editions and current market metrics.

This is an intelligence product, not a generic chatbot. Be concise, commercially useful and explicit about uncertainty. Australian English. No hype, no emojis, no exclamation marks, no em dashes.

GROUNDING RULES:
- Never invent a fact, number, date, source, causal claim or market movement.
- Every material factual claim must be supported by at least one supplied source.
- sourceRefs may contain only source numbers that appear in the evidence.
- If the evidence is mixed, say so.
- If a numeric signal is not explicitly present in the evidence, do not create one.
- Current metric rows are authoritative only for the value and context explicitly shown. Do not infer a percentage change from current versus previous values unless that change itself is supplied in the evidence.
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
