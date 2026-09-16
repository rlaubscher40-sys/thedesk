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
  const paragraphs = articleText.slice(0, 16000).split(/\n+/);
  const candidates = paragraphs
    .flatMap((p) => p.split(/(?<=[.!?])\s+/))
    .map(cleanReportingExcerpt)
    .filter(
      (s) =>
        s.length >= 55 &&
        s.length <= 1800 &&
        /[.!?]$/.test(s) &&
        !looksLikeGarbage(s) &&
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
  const first = ranked[0];
  if (!first) return "";
  if (first.text.length > max) {
    const clip = first.text.slice(0, max - 1);
    return clip.slice(0, clip.lastIndexOf(" ")).trimEnd() + "…";
  }
  const following = candidates[first.index + 1];
  return following && first.text.length + following.length + 1 <= max
    ? `${first.text} ${following}`
    : first.text;
}
