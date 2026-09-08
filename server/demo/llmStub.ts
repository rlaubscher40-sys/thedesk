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

/**
 * A Reel voice-over, for demo mode.
 *
 * Deliberately contains no digits. `rejectScript` checks every figure a script
 * states against the facts it was given, and those facts differ per metric, so
 * a stub with numbers in it would be rejected on every run — which would show a
 * developer the fallback path forever and teach them the feature is broken.
 * With no figures to check it passes, and the preview endpoint shows the real
 * pacing of a written script rather than the plain read.
 */
const REEL_SCRIPT_JSON = JSON.stringify({
  open: "This series has just done something it has not done in years.",
  number: "Here is where it landed.",
  meaning: "That is a clear move, and the direction is what matters here.",
  context: "It is the first time the series has reached this point.",
  detail: "It sits well away from the typical reading, and near the edge of the range.",
});

const ASK_DESK_JSON = JSON.stringify({
  status: "answered",
  headline: "Credit capacity is doing more of the work than sentiment.",
  answer:
    "The archive points to borrowing capacity and lender competition as the more useful near-term signal. The rate headline matters, but the transmission into approvals, refinancing and investor activity is where the practical change shows up.",
  whyItMatters:
    "A market can look unchanged at the headline level while finance conditions underneath it are already improving. That gap is where buyer behaviour can move before listings and prices make the shift obvious.",
  deskTake:
    "The better question is not whether confidence has returned. It is whether more borrowers can transact at today's prices. If capacity keeps improving, demand can strengthen without a dramatic change in the public narrative.",
  whatWouldChangeOurMind:
    "A sustained deterioration in approvals, a reversal in lender pricing, or evidence that improved borrowing capacity is not translating into transactions would weaken that view.",
  signals: [],
  sourceRefs: [1],
  confidence: "medium",
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

  const text = params.messages
    .map((m) => m.content)
    .join("\n")
    .toLowerCase();
  const isJson = params.responseFormat?.type === "json_schema";

  // Before the generic JSON branch, because this one also asks for JSON and
  // would otherwise be answered with a Substack draft.
  if (text.includes("voice-over for a 20-second instagram reel")) return REEL_SCRIPT_JSON;

  if (text.includes("market comparison")) {
    // Demo responses extract the supplied local sentences; they never invent a
    // market verdict or borrow the generic Ask canned answer.
    const input = JSON.parse(params.messages.find((m) => m.role === "user")?.content ?? "{}");
    const definitions = [
      ["rents", /rents?|vacancy/i],
      ["prices", /prices?|values?/i],
      ["supply", /housing supply/i],
    ] as const;
    const rows = definitions.flatMap(([dimension, pattern]) => {
      const observations = (["a", "b"] as const).map((side) => {
        const market = side === "a" ? input.marketA : input.marketB;
        for (const source of input.sources ?? []) {
          if (!source.markets.includes(side)) continue;
          const quote = source.text
            .split(/(?<=[.!?])\s+|\n/)
            .find(
              (sentence: string) =>
                sentence.toLowerCase().includes(market.toLowerCase()) &&
                pattern.test(sentence) &&
                sentence.length >= 12 &&
                sentence.length <= 360
            );
          if (quote) return { sourceRef: source.ref, quote, basis: null };
        }
        return null;
      });
      return observations.some(Boolean)
        ? [
            {
              dimension,
              marketA: observations[0] ?? null,
              marketB: observations[1] ?? null,
              read: "These local observations describe the available coverage. They do not establish a comparable market advantage.",
              edge: "unclear",
            },
          ]
        : [];
    });
    return JSON.stringify({
      verdict: "No clear edge on the available evidence.",
      deskTake:
        "The demo illustrates the evidence trail. A stronger call requires comparable local observations across the same periods and dwelling types.",
      whatWouldChangeTheCall:
        "Comparable local supply and rental evidence would make the trade-off clearer.",
      confidence: "low",
      rows,
    });
  }

  // Ask also uses a strict JSON schema, so identify it before the generic
  // JSON branch used by the Substack demo stub.
  if (
    text.includes("ask the desk intelligence answer") ||
    text.includes("property intelligence analyst")
  ) {
    return ASK_DESK_JSON;
  }

  // Order matters: the Take prompt mentions "Substack essay" in its style
  // guide, so dispatch on the JSON format flag (only Substack uses it after
  // the Ask branch above) before any text-content matching.
  if (isJson) return SUBSTACK_DRAFT_JSON;

  // 3-role partner-tag block, easy to fingerprint by its labels.
  if (text.includes("write exactly 3 lines") || text.includes("buyers agent:")) {
    return PARTNER_TAG_BLOCK;
  }

  // Default: Ruben's Take. Rotates so repeated clicks feel different.
  const idx = Math.floor(Math.random() * TAKES.length);
  return TAKES[idx]!;
}
