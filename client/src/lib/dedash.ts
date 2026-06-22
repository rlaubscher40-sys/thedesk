/**
 * Strip em/en dashes from rendered copy.
 *
 * The product's voice (and the LLM enrichment it generates daily) leans on the
 * em-dash, which reads as an AI tell and isn't the house style. This turns a
 * dash used as prose punctuation into a comma, while preserving numeric ranges
 * (e.g. "45–54", "40–15%") as hyphens so figures don't get split into a list.
 *
 * Applied at the central display helpers (cleanHeadline, cardDek) and the
 * editorial line components so both static and dynamic text are covered in one
 * place — no need to hand-edit each daily story.
 */
export function dedash(text: string): string {
  if (!text) return text;
  // Skip the substitution chain on absurdly long input (malformed/garbage rows
  // far past any real headline or paragraph). Running six global regexes over a
  // multi-kilobyte blob on every render is what can hang a mobile WebKit tab;
  // the content is returned untouched rather than truncated.
  if (text.length > 20_000) return text;
  return (
    text
      // Numeric ranges first: keep 45–54 / 40–15 as a hyphen, not a comma.
      .replace(/(\d)\s*[–—]\s*(\d)/g, "$1-$2")
      // Any remaining em/en dash used as punctuation → comma + space.
      .replace(/\s*[—–]\s*/g, ", ")
      // Tidy the artefacts the substitution can create.
      .replace(/\s+,/g, ",")
      .replace(/,\s*,/g, ",")
      .replace(/\s{2,}/g, " ")
      .replace(/,\s*$/g, "")
      .trim()
  );
}
