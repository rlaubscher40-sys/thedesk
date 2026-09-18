import { regionalContext } from "../../shared/regionalContext";
import type { FactEvidence } from "../localData/read";
import type { AskContextSource } from "../prompts/ask";

/** Only an inventory request can use the deterministic context answer. Extra
 * clauses, comparisons and forecasts must go through normal evidence review. */
function contextMarket(question: string): string | undefined {
  return question
    .trim()
    .match(
      /^(?:what does the desk know about|what reviewed sources does the desk have about) (Townsville|Newcastle)\??$/i
    )?.[1]
    ?.toLowerCase();
}

export function reviewedRegionalFacts(question: string, asOf: string): FactEvidence[] {
  const market = contextMarket(question);
  if (!market) return [];
  return regionalContext(market, asOf).map((entry) => ({
    reviewedContext: true,
    title: `${market === "townsville" ? "Townsville" : "Newcastle"}: ${entry.title}`,
    date: entry.publishedOn,
    href: `/markets/${market}#primary-context`,
    publisher: entry.publisher,
    sourceUrl: entry.sourceUrl,
    text: `${entry.publisher}, published ${entry.publishedOn}: ${entry.summary} ${entry.limitation} Reviewed ${entry.reviewedOn}.${entry.reviewDue ? " Review is due; ongoing status has not been reverified." : ""}`,
  }));
}

export function directRegionalContextAnswer(
  question: string,
  facts: FactEvidence[],
  evidence: AskContextSource[]
) {
  if (!contextMarket(question) || !facts.length || facts.some((fact) => !fact.reviewedContext))
    return null;
  const selected = facts.map((fact) => ({
    fact,
    source: evidence.find(
      (source) =>
        source.category === "REVIEWED CONTEXT" &&
        source.title === fact.title &&
        source.date === fact.date &&
        source.text === fact.text
    ),
  }));
  if (selected.some(({ source }) => !source)) return null;
  const answer = selected
    .map(({ fact, source }) => `${fact.text} [Source ${source!.ref}]`)
    .join("\n\n");
  if (answer.length > 2600) return null;
  return {
    status: "answered" as const,
    headline: "The Desk's reviewed local sources",
    answer,
    whyItMatters:
      "These dated primary sources establish the specific announcements described. They are context for further reading, not a complete survey of this market.",
    deskTake:
      "These records do not establish current prices, vacancy, yields or an investment outlook. Construction, funding and proposed planning changes must keep their distinct status.",
    whatWouldChangeOurMind:
      "A subsequent official decision, corrected release or delivery update could change the position. Check the original source and publication date before relying on ongoing status.",
    signals: [],
    sourceRefs: selected.map(({ source }) => source!.ref),
    confidence: "high" as const,
  };
}
