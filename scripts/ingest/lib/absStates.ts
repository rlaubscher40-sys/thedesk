/**
 * Pulling a per-jurisdiction table out of an ABS release page.
 *
 * The rest of `abs.ts` is shaped around one headline number per page: find a
 * phrase, take the nearest number. That does not work for the figures worth the
 * most editorially — net interstate migration, dwelling approvals by state —
 * because those are tables of eight jurisdictions, and "the nearest number to
 * the words New South Wales" is a different problem from "the nearest number to
 * the words net overseas migration".
 *
 * This does that job, and does it defensively, because the input is someone
 * else's HTML and it changes without warning.
 *
 * ## Why this is separate from the metric ingest
 *
 * It is deliberately not wired into the daily run yet. The extraction below is
 * tested against a fixture shaped like an ABS table, which proves the parsing
 * logic; it is NOT yet proven against the live page, and the live page is the
 * only thing that counts. `scripts/ingest/probe-abs.ts` exists to close that
 * gap: run it against the real URL, read what comes back, and only then wire
 * the result into the ingest.
 *
 * Shipping an unverified scraper into a daily job is how you get a metric that
 * silently reports nothing for a month, which is worse than not having it.
 */

/** The eight jurisdictions, with the abbreviations ABS tables mix in.
 *  Longest names first so "Australian Capital Territory" is matched before a
 *  naive scan could trip on the word "Australia" inside it. */
export const AU_JURISDICTIONS: Array<{ code: string; names: string[] }> = [
  { code: "ACT", names: ["Australian Capital Territory"] },
  { code: "NT", names: ["Northern Territory"] },
  { code: "NSW", names: ["New South Wales"] },
  { code: "WA", names: ["Western Australia"] },
  { code: "SA", names: ["South Australia"] },
  { code: "QLD", names: ["Queensland"] },
  { code: "VIC", names: ["Victoria"] },
  { code: "TAS", names: ["Tasmania"] },
];

export type StateFigure = {
  code: string;
  jurisdiction: string;
  /** The parsed number, negative where the page marked it so. */
  value: number;
  /** Exactly as it appeared, for eyeballing against the page. */
  raw: string;
};

/** Strip tags and collapse whitespace so a figure split across table cells
 *  still sits near its label. Entities that matter to a number are decoded;
 *  everything else becomes a space rather than being glued together. */
export function flattenHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&minus;|&#8722;|−|–/g, "-")
    .replace(/&amp;/gi, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A number is only credible as this jurisdiction's figure if it sits close to
 * the name. ABS tables put the value in the next cell or two; 120 characters of
 * flattened text covers that without reaching into the following row.
 */
const SEARCH_WINDOW = 120;

/** Matches 1,234 / -1,234 / 12345 / (1,234) — brackets being the accounting
 *  convention for a negative, which matters enormously for net migration. */
const NUMBER_RE = /(\(\s*-?[\d,]+\s*\)|-?\d{1,3}(?:,\d{3})+|-?\d{3,})/;

function parseFigure(raw: string): number | null {
  const bracketed = /^\(\s*-?[\d,]+\s*\)$/.test(raw.trim());
  const cleaned = raw.replace(/[(),\s]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  // Brackets mean negative. A state losing 21,465 people and one gaining them
  // are opposite stories, so getting this wrong is not a rounding error.
  return bracketed ? -Math.abs(n) : n;
}

/**
 * Find each jurisdiction's figure in a flattened page.
 *
 * Returns only what it actually found. A partial result is reported as partial
 * rather than padded with zeroes: a missing state is a broken pattern, and
 * publishing "Tasmania: 0" because the regex drifted would be a fabricated
 * number on a series whose whole value is that its numbers are real.
 */
export function extractStateFigures(html: string): StateFigure[] {
  const text = flattenHtml(html);
  const out: StateFigure[] = [];

  for (const { code, names } of AU_JURISDICTIONS) {
    for (const name of names) {
      const at = text.indexOf(name);
      if (at === -1) continue;
      const window = text.slice(at + name.length, at + name.length + SEARCH_WINDOW);
      const m = window.match(NUMBER_RE);
      if (!m || !m[1]) continue;
      const value = parseFigure(m[1]);
      if (value === null) continue;
      out.push({ code, jurisdiction: name, value, raw: m[1].trim() });
      break;
    }
  }
  return out;
}

/**
 * Is this a plausible interstate-migration table?
 *
 * Net interstate migration is a transfer between states, so the eight figures
 * sum to approximately zero. That is a free correctness check on the whole
 * extraction, and it is the reason to prefer this series: if the numbers do not
 * balance, the patterns picked up the wrong column and the run should be
 * dropped rather than published.
 *
 * `tolerance` is generous because ABS rounds each figure independently.
 */
export function looksLikeInterstateMigration(figures: StateFigure[], tolerance = 2000): boolean {
  if (figures.length !== AU_JURISDICTIONS.length) return false;
  const sum = figures.reduce((n, f) => n + f.value, 0);
  return Math.abs(sum) <= tolerance;
}
