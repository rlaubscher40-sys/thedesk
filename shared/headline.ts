/**
 * Headline + summary hygiene, shared by the ingest (cleans what gets stored)
 * and the feed cards (cleans how stored items render).
 *
 * Google News — which backs most of our topic queries and every coverage lane
 * — bakes a " - Publisher" suffix into each title and returns a description
 * that's just the title again. On the enriched lanes the LLM lines mask it; on
 * the coverage lanes it shows as a headline with a near-identical subline — a
 * visible double-up. These helpers strip the suffix and detect the redundant
 * summary so it can be dropped at ingest or skipped at render.
 */

/**
 * Upper bound on the input length these helpers run their regexes over. A real
 * headline or summary is a few hundred characters; anything past this is
 * malformed/extraction garbage (e.g. a Google-News JS interstitial blob). The
 * helpers short-circuit beyond it so a single pathological row can never make a
 * regex backtrack long enough to hang a mobile WebKit render — the symptom
 * behind Safari's "A problem repeatedly occurred" tab crash. Set far above any
 * legitimate value, so genuine content is never affected.
 */
export const MAX_HELPER_INPUT = 20_000;

/** Normalise to lowercase alphanumeric words for comparison. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim();
}

/**
 * Drop a trailing bare source/domain token ("realestate.com.au", "ig.com",
 * "abc.net.au", "www.example.com") that publisher RSS — Google News especially
 * — tacks onto the end of a description. Left in place it pads the length of an
 * otherwise headline-echoing summary just enough to slip past the redundancy
 * ratio below, so the card shows a near-duplicate subline. Conservative: only a
 * single trailing domain-shaped token is removed, so prose that merely mentions
 * a URL mid-sentence is untouched.
 */
function stripTrailingDomain(s: string): string {
  return s.replace(/\s+(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\/?\s*$/iu, "").trim();
}

/**
 * True when a string is code / boilerplate rather than prose. Google News
 * article links resolve to a JavaScript interstitial ("DotsSplash" / Closure
 * Library) instead of the real page, so body-text extraction can scoop up
 * script soup. Catches the telltale code markers and symbol-soup so it never
 * reaches a card or gets stored as a summary.
 */
export function looksLikeGarbage(text: string | null | undefined): boolean {
  if (!text) return false;
  // Past the helper ceiling it's a garbage blob by definition — no legitimate
  // summary runs this long. Treat it as garbage without running the regexes
  // over the whole string (which is the part that can hang).
  if (text.length > MAX_HELPER_INPUT) return true;
  const t = text.trim();
  if (!t) return false;
  if (
    /\buse strict\b|function\s*\(|\bvar\s+[\w$]+\s*=|=>|;\}|\{\}|\bwindow\b\s*=|Closure Library|Copyright\s+The\s+[\w.]+\s+Authors|document\.|\.prototype\b|\b[\w$]+\.[\w$]+\s*=\s*function/iu.test(
      t
    )
  ) {
    return true;
  }
  // Symbol-soup: too much code punctuation relative to letters.
  const symbols = (t.match(/[{}();=<>\\|_]/gu) || []).length;
  const letters = (t.match(/[a-z]/giu) || []).length;
  if (letters > 0 && symbols / letters > 0.15) return true;
  // Real prose breathes — very few spaces means it's a minified blob.
  const spaces = (t.match(/\s/gu) || []).length;
  if (t.length > 40 && spaces / t.length < 0.05) return true;
  return false;
}

/**
 * Whether a card should render the summary at all: present, not a redundant
 * echo of the title, and not extraction garbage. The single predicate the
 * feed cards use so the three of them stay consistent.
 */
export function shouldShowSummary(
  title: string,
  summary: string | null | undefined
): boolean {
  if (!summary) return false;
  if (isRedundantSummary(title, summary)) return false;
  if (looksLikeGarbage(summary)) return false;
  return true;
}

/**
 * Strip a trailing " - Publisher" / " – Publisher" suffix that Google News
 * appends to headlines. Conservative: only strips when the tail looks like a
 * source name (short, no terminal sentence punctuation), so real title clauses
 * survive. The publisher is shown separately via the source byline.
 */
export function cleanHeadline(title: string): string {
  if (title.length > MAX_HELPER_INPUT) return title;
  const m = title.match(/^(.*\S)\s+[-–—]\s+([^-–—]{1,40})$/u);
  if (!m || !m[1] || !m[2]) return title;
  const head = m[1].trim();
  const tail = m[2].trim();
  if (!head) return title;
  if (/[.!?:]$/u.test(tail)) return title; // looks like a clause, not a source
  if (tail.split(/\s+/u).length > 6) return title; // too long to be a masthead
  return head;
}

/**
 * True when a summary adds nothing over the headline — i.e. it's the title
 * repeated (optionally with the source appended), as Google News descriptions
 * are. Callers drop the subline in that case rather than show a double-up.
 */
export function isRedundantSummary(
  title: string,
  summary: string | null | undefined
): boolean {
  if (!summary) return true;
  // A summary longer than the helper ceiling can't be a redundant echo of a
  // (short) headline, and normalising it would mean a full regex pass over the
  // blob. Short-circuit: not redundant, leave the garbage check to do its job.
  if (summary.length > MAX_HELPER_INPUT) return false;
  const nt = norm(cleanHeadline(title));
  // Strip a trailing source domain first so "Headline. publisher.com" is judged
  // on its prose, not padded past the redundancy threshold by the domain.
  const ns = norm(stripTrailingDomain(summary));
  if (!ns) return true;
  if (ns === nt) return true;
  // Summary is the title plus a few trailing words (the source), or vice versa.
  if (nt && (ns.startsWith(nt) || nt.startsWith(ns))) {
    const longer = Math.max(ns.length, nt.length);
    const shorter = Math.min(ns.length, nt.length);
    if (longer > 0 && shorter / longer >= 0.7) return true;
  }
  return false;
}
