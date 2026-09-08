const STOP_WORDS = new Set([
  "about", "after", "again", "against", "because", "before", "being", "could",
  "does", "from", "have", "into", "should", "their", "there", "these", "thing",
  "think", "this", "those", "what", "when", "where", "which", "would", "with",
  "changing", "changed", "happening", "current", "currently", "latest", "recent",
  "recently", "today", "right", "now", "know", "desk", "tell", "please", "explain",
  "the", "and", "for", "are", "can", "how", "has", "was", "will", "get",
]);
const BROAD_TERMS = new Set(["property", "market", "markets", "australia", "australian"]);

export function normaliseAskText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Match complete words, allowing a simple plural, never embedded substrings. */
function hasWord(words: ReadonlySet<string>, term: string): boolean {
  if (words.has(term)) return true;
  const plural = term.endsWith("s") ? term.slice(0, -1) : `${term}s`;
  return words.has(plural);
}

export function hasAskTerm(text: string, term: string): boolean {
  return hasWord(new Set(normaliseAskText(text).split(" ")), term);
}

export function askQueryTerms(question: string): string[] {
  const terms = [...new Set(normaliseAskText(question).split(" "))]
    .filter((word) => (word.length >= 3 || ["wa", "sa", "nt"].includes(word)) && !STOP_WORDS.has(word));
  const specific = terms.filter((term) => !BROAD_TERMS.has(term));
  return specific.length > 0 ? specific : terms;
}

/** Rank the combined candidate set before capping, using the whole question. */
export function rankAskRecords<T>(
  question: string,
  rows: T[],
  fields: { title: (row: T) => string; body: (row: T) => string; date: (row: T) => Date | string | null | undefined },
  limit: number
): T[] {
  const terms = askQueryTerms(question);
  return rows.map((row, index) => {
    const titleWords = new Set(normaliseAskText(fields.title(row)).split(" "));
    const bodyWords = new Set(normaliseAskText(fields.body(row)).split(" "));
    let coverage = 0;
    let titleMatches = 0;
    for (const term of terms) {
      const inTitle = hasWord(titleWords, term);
      if (inTitle) titleMatches++;
      if (inTitle || hasWord(bodyWords, term)) coverage++;
    }
    const date = fields.date(row);
    const timestamp = date instanceof Date ? date.getTime() : Date.parse(date ?? "");
    return { row, index, score: coverage * coverage * 4 + titleMatches * 8, timestamp: Number.isFinite(timestamp) ? timestamp : 0 };
  })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.timestamp - a.timestamp || a.index - b.index)
    .slice(0, limit)
    .map(({ row }) => row);
}
