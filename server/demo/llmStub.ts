/**
 * Canned LLM responses for demo mode. Each generator's prompt has a
 * recognisable signature in the system or user message; we sniff for it and
 * return something realistic enough that the UI behaves the same as it would
 * with a real LLM.
 */
import type { InvokeLlmParams } from "../core/llm";

const TAKES = [
  "The decision was the easy part. The interesting story is what the broker channel does in the four weeks after a hold. Last cycle that's where the real action was, and the pattern is rhyming. Watch fixed-rate roll-off volumes, not the cash rate.",
  "Capacity, not demand, is the real constraint at the top of the market. Three mid-tier agencies paused intake this week without saying anything publicly. Where the referrals land is the more useful question.",
  "Wages do not move markets the way headlines suggest. The composition does. This week's print was firmer on private services, which is the segment the RBA wants softer. The narrative will simplify it. The data has not.",
];

const SUBSTACK_DRAFT_JSON = JSON.stringify({
  title: "The Decision Was the Easy Part",
  subtitle:
    "What the broker channel does in the four weeks after a hold tells you more than the hold itself.",
  body: [
    "I was on a call with a broker friend the morning the decision dropped. He had three settlements lined up that afternoon and a presentation at five.",
    "The RBA had just held the cash rate at 4.35%. Nothing about his day changed. Nothing about his clients' files changed. The presentation he was giving had been written a week earlier and would have read the same either way.",
    "---",
    "The decision is the headline. The interesting story is the four weeks after.",
    "Last cycle, when the RBA held in March and again in May, broker channel share crept up almost a full percentage point through June. Not because anyone changed their mind. Because the holds gave clients permission to sit still, and sitting still in a refi market means the existing broker keeps the relationship.",
    "This time, the data is starting to rhyme.",
    "---",
    "_If this landed, I write two of these a week. Subscribe and I'll send them straight to your inbox._",
  ].join("\n\n"),
});

const PARTNER_TAG_BLOCK = [
  "Broker: Conversation pivots to fixed-rate roll-offs landing in mid-June.",
  "Adviser: Refresh the 'rates higher for longer' framing, patience gives clients permission to plan.",
  "Buyers Agent: Sentiment shifts before listings do. Expect more pre-auction offers in the next four weeks.",
].join("\n");

/**
 * Mock the LLM in demo mode. Sniffs the prompt fingerprints in the user
 * message to decide which canned response to return.
 */
export async function demoLlm(params: InvokeLlmParams): Promise<string> {
  // Light artificial latency, makes the UI's loading state visible.
  await new Promise((r) => setTimeout(r, 600));

  const text = params.messages.map((m) => m.content).join("\n").toLowerCase();
  const isJson = params.responseFormat?.type === "json_schema";

  // Order matters: the Take prompt mentions "Substack essay" in its style
  // guide, so dispatch on the JSON format flag (only Substack uses it)
  // before any text-content matching.
  if (isJson) return SUBSTACK_DRAFT_JSON;

  // 3-role partner-tag block, easy to fingerprint by its labels.
  if (text.includes("write exactly 3 lines") || text.includes("buyers agent:")) {
    return PARTNER_TAG_BLOCK;
  }

  // Default: Ruben's Take. Rotates so repeated clicks feel different.
  const idx = Math.floor(Math.random() * TAKES.length);
  return TAKES[idx]!;
}
