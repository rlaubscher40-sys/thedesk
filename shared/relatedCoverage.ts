import { originalPublicationDay, conflictingLocations, type EventStory } from "./storyEvent";
import { bestMatch, titleTokens } from "./textSimilarity";
import { sharesReporting, type EvidenceFingerprint } from "./storyEvidenceDuplicate";

export type RelatedStory = EventStory & {
  id?: number;
  summary?: string | null;
  articleText?: string | null;
  evidenceFingerprint?: EvidenceFingerprint | null;
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
      ...text.matchAll(/\b(?:homes|dwellings|dwelling starts)\s+by\s+(\d[\d,]*)\b/gi),
    ]
      .map((m) => m[1]!.replace(/,/g, ""))
      .filter((n) => Number(n) >= 100)
  );
}
function crisisGrantClaims(story: RelatedStory): Set<string> {
  const text = `${story.title} ${story.summary ?? ""} ${story.articleText?.slice(0, 6000) ?? ""}`;
  if (
    !/\b(?:HAFF|Housing Australia Future Fund)\b/i.test(text) ||
    !/\bcrisis and transitional\b/i.test(text) ||
    !/\bgrants?\b/i.test(text)
  )
    return new Set();
  return new Set(
    [...text.matchAll(/\$([\d,]+)\s*(million|m)\b/gi)].map((m) => m[1]!.replace(/,/g, ""))
  );
}
function namedReleaseClaims(story: RelatedStory): Set<string> {
  const text = `${story.title} ${story.summary ?? ""} ${story.articleText?.slice(0, 6000) ?? ""}`;
  const series =
    /\b(?:HIA|Housing Industry Association)\b/i.test(text) && /\bnew.home sales\b/i.test(text)
      ? "hia-sales"
      : /\bEquifax\b/i.test(text) && /\b(?:credit|mortgage|first.home.buyer) demand\b/i.test(text)
        ? "equifax-demand"
        : /\bANZ[–—-]?\s*Roy Morgan\b/i.test(text) && /\bconsumer confidence\b/i.test(text)
          ? "anz-confidence"
          : null;
  if (!series) return new Set();
  const months = [
    ...text.matchAll(
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/gi
    ),
  ].map((m) => m[0].toLowerCase());
  // Monthly series need a common reporting month as well as a common figure.
  if (series !== "anz-confidence" && !months.length) return new Set();
  const figures = [
    ...text.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:%|per cent\b|percent\b|points\b)/gi),
  ].map((m) => m[1]);
  return new Set(
    (series === "anz-confidence" ? ["weekly"] : months).flatMap((month) =>
      figures.map((n) => `${series}:${month}:${n}`)
    )
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
  const grants = crisisGrantClaims(story);
  const release = namedReleaseClaims(story);
  const releaseParent =
    local(story) &&
    eligible.find(
      (c) =>
        originalPublicationDay(c) === day &&
        [...namedReleaseClaims(c)].some((key) => release.has(key))
    );
  const grantParent =
    local(story) &&
    eligible.find(
      (c) =>
        originalPublicationDay(c) === day && [...crisisGrantClaims(c)].some((n) => grants.has(n))
    );
  return (
    eligible.find((c) => sharesReporting(story, c)) ||
    modelParent ||
    grantParent ||
    releaseParent ||
    bestMatch(
      titleTokens(story.title),
      eligible.map((value) => ({ value, tokens: titleTokens(value.title) }))
    )
  );
}
