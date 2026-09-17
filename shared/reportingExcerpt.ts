import { looksLikeGarbage, looksLikeSiteBoilerplate } from "./headline";

const STOP = new Set(
  "about after again against also among before could have into many more most says said that their them there these they this those through under what when where which while will with would your from than been were over news australia australian".split(
    " "
  )
);
const words = (s: string) => [
  ...new Set(
    (s.toLowerCase().match(/[a-z]{3,}/g) ?? [])
      .map((w) => w.replace(/(?:ing|ed|s)$/, ""))
      .filter((w) => !STOP.has(w))
  ),
];

/** A standalone excerpt must not leave the speaker or subject in an omitted paragraph. */
function needsPreviousContext(text: string): boolean {
  return (
    /^(?:i|we|our|he|she|they|it|this|that|these|those|for people already living that reality)\b/i.test(
      text
    ) ||
    /^(?:it comes as|in (?:other|earlier) news|meanwhile)\b/i.test(text) ||
    /["”']?,?\s+(?:he|she|they)\s+(?:said|added|warned|told|argued)\b/i.test(text)
  );
}

/** Suppress a short restatement only when it adds neither vocabulary nor figures.
 * Negations and changed numbers remain significant; this is not semantic deduplication. */
function repeatsFinding(first: string, next: string): boolean {
  const known = new Set(words(first));
  const terms = words(next);
  const figures = (text: string) => text.match(/[+-]?\d[\d,.]*(?:%|\b)/g) ?? [];
  const knownFigures = new Set(figures(first));
  return (
    terms.length >= 6 &&
    terms.every((word) => known.has(word)) &&
    figures(next).every((figure) => knownFigures.has(figure))
  );
}

/** Captions are not reporting evidence, even when they repeat the headline. */
export function isPhotoCaption(text: string): boolean {
  return (
    /\b(?:picture|photo|photograph|image)(?:s)?\s*(?:credit)?\s*:/i.test(text) ||
    /^(?:artist'?s? impressions?|renders? (?:for|of)|pictured (?:above|below|here)|image supplied)\b/i.test(
      text.trim()
    )
  );
}

/** Remove recognisable syndication chrome, never silently complete clipped prose. */
export function cleanReportingExcerpt(text: string): string {
  return text
    .replace(/\bThe post\s+.{0,500}?\s+appeared first on\s+.{0,150}?(?:\.|$)/gi, "")
    .replace(/\s*\(pictured\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extractive fallback, not a semantic summary. Choose a relevant complete
 * reporting sentence rather than assuming the first paragraph is the finding.
 * No model call, rewritten fact, heading, byline or invented continuation. */
export function reportingExcerpt(title: string, articleText: string, max = 380): string {
  const terms = words(title);
  const paragraphs = articleText
    .slice(0, 16000)
    .split(/\n+/)
    .filter((p) => !isPhotoCaption(p));
  const candidates = paragraphs
    .flatMap((p) => p.split(/(?<=[.!?])\s+/))
    .map(cleanReportingExcerpt)
    .filter(
      (s) =>
        s.length >= 55 &&
        s.length <= 1800 &&
        /[.!?]$/.test(s) &&
        !looksLikeGarbage(s) &&
        !needsPreviousContext(s) &&
        !looksLikeSiteBoilerplate(s) &&
        !/^(?:by |published|updated|minister for|deputy premier|the honourable|share this|read more|image:|photo:)/i.test(
          s
        )
    );
  const ranked = candidates
    .map((text, index) => {
      const present = new Set(words(text));
      const overlap = terms.filter((term) => present.has(term)).length;
      return { text, index, overlap, score: overlap + (overlap && /\d/.test(text) ? 0.5 : 0) };
    })
    .filter((c) => c.overlap > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  // A relevant opening finding should beat a later keyword-rich aside or quote.
  // Keep the strongest match when the lead is an analogy or off-topic.
  const lead = ranked.find((candidate) => candidate.index === 0);
  const first = lead && lead.overlap >= 2 ? lead : ranked[0];
  if (!first) return "";
  if (first.text.length > max) {
    const clip = first.text.slice(0, max - 1);
    return clip.slice(0, clip.lastIndexOf(" ")).trimEnd() + "…";
  }
  const following = candidates[first.index + 1];
  return following &&
    !repeatsFinding(first.text, following) &&
    first.text.length + following.length + 1 <= max
    ? `${first.text} ${following}`
    : first.text;
}
