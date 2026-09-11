import { originalPublicationDay, conflictingLocations, type EventStory } from "./storyEvent";
import { bestMatch, titleTokens } from "./textSimilarity";

export type RelatedStory = EventStory & {
  id?: number;
  summary?: string | null;
  articleText?: string | null;
};
/** A relation, not a duplicate or independent corroboration. Never hides rows.
 * Generated angles are intentionally absent from this input. */
function housingModelClaims(story: RelatedStory): Set<string> {
  const text = `${story.title} ${story.summary ?? ""} ${story.articleText?.slice(0, 6000) ?? ""}`;
  if (
    !/\b(?:modelling|modeling|housing (?:reforms|package))\b/i.test(text) ||
    !/\b(?:housing|negative gearing|capital gains|SMSF)\b/i.test(text)
  )
    return new Set();
  return new Set(
    [
      ...text.matchAll(
        /\b(\d[\d,]*)\s+(?:fewer |new |residential )*(?:homes|dwellings|dwelling starts)\b/gi
      ),
    ]
      .map((m) => m[1]!.replace(/,/g, ""))
      .filter((n) => Number(n) >= 100)
  );
}
export function relatedCoverageParent<T extends RelatedStory & { id: number }>(
  story: RelatedStory,
  candidates: T[]
): T | null {
  const day = originalPublicationDay(story);
  const local = (s: RelatedStory) => ["AU", "PROPERTY"].includes(s.channel ?? "");
  const eligible = candidates.filter((c) => {
    if (
      c.id === story.id ||
      c.channel === "HOLD" ||
      !(c.channel === story.channel || (local(c) && local(story)))
    )
      return false;
    if (conflictingLocations(story.title, c.title)) return false;
    const priorDay = originalPublicationDay(c);
    return (
      !!day &&
      !!priorDay &&
      priorDay <= day &&
      Date.parse(day) - Date.parse(priorDay) <= 3 * 86400000
    );
  });
  const claims = housingModelClaims(story);
  const modelParent =
    local(story) && eligible.find((c) => [...housingModelClaims(c)].some((n) => claims.has(n)));
  return (
    modelParent ||
    bestMatch(
      titleTokens(story.title),
      eligible.map((value) => ({ value, tokens: titleTokens(value.title) }))
    )
  );
}
