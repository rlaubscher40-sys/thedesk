import type { FactEvidence } from "../localData/read";

/** Narrow factual lookups should quote data, not ask a model to elaborate.
 * One publisher/method, at most four selected observations. Broader questions
 * and incompatible source definitions continue through normal synthesis.
 */
export function directLocalRentAnswer(question: string, facts: FactEvidence[]) {
  if (
    !/\b(?:what (?:is|was|are|were)|give|show|compare)\b/i.test(question) ||
    !/\b(?:median|weekly)\b/i.test(question) ||
    !/\brent(?:s|al)?\b/i.test(question) ||
    /\b(?:why|outlook|forecast|invest\w*|buy|recommend\w*|should|caus\w*|drivers?|vacancy|yield|affordability|population|migration|approvals?)\b/i.test(
      question
    ) ||
    !facts.length ||
    facts.some((fact) => !fact.localRent) ||
    new Set(facts.map((fact) => fact.sourceUrl)).size !== 1 ||
    new Set(facts.map((fact) => fact.localRent!.method)).size !== 1
  )
    return null;
  const observations = facts.flatMap((fact, index) =>
    fact.localRent!.observations.map((row) => ({ fact, row, ref: index + 1 }))
  );
  if (
    !observations.length ||
    observations.length > 4 ||
    observations.some(
      ({ row }) =>
        row.value === null ||
        row.status !== "published" ||
        row.unit !== "AUD/week" ||
        !Number.isFinite(row.value)
    )
  )
    return null;

  const answer = observations
    .map(({ fact, row, ref }) => {
      const value = row.value!.toLocaleString("en-AU", { maximumFractionDigits: 2 });
      const sample = row.sample === null ? "" : ` ${row.sampleLabel}: ${row.sample}.`;
      return `${fact.title}. ${row.category}: $${value}/week, ${row.periodLabel}.${sample} [Source ${ref}]`;
    })
    .join("\n\n");
  const method = facts[0]!.localRent!.method;
  if (answer.length > 2600 || method.length > 1800) return null;
  return {
    status: "answered" as const,
    headline:
      observations.length === 1
        ? "The stored weekly rent observation"
        : "The stored weekly rent observations",
    answer,
    whyItMatters: method,
    deskTake:
      "These figures describe the stated categories, source geographies and reporting periods. They do not establish a current negotiation price, vacancy rate or investment return. Contextual bond counts alone do not establish statistical reliability or explain why rents changed.",
    whatWouldChangeOurMind:
      "A corrected publisher release for the same observation would change the reported figure. A later release describes a different reporting period and should be cited separately.",
    signals: [],
    sourceRefs: facts.map((_fact, index) => index + 1),
    confidence: "high" as const,
  };
}
