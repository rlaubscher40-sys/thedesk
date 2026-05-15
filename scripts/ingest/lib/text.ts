/**
 * Tiny HTML / entity utilities for cleaning RSS payloads before they hit
 * the server. The server has its own sanitiser pass, but it expects
 * already-plain text — these helpers strip markup and decode entities so
 * the LLM enrichment downstream isn't tripping over raw HTML.
 */

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
  "&hellip;": "...",
  "&mdash;": "-",
  "&ndash;": "-",
  "&rsquo;": "'",
  "&lsquo;": "'",
  "&rdquo;": '"',
  "&ldquo;": '"',
};

export function decodeEntities(s: string): string {
  let out = s;
  for (const [k, v] of Object.entries(ENTITY_MAP)) {
    out = out.split(k).join(v);
  }
  // Numeric entities: &#1234;
  out = out.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  // Hex entities: &#x1F4A9;
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
  return out;
}

export function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function plainText(s: string | null | undefined, max = 480): string {
  if (!s) return "";
  const clean = decodeEntities(stripHtml(s)).trim();
  if (clean.length <= max) return clean;
  // Truncate at the last sentence boundary before `max`.
  const cut = clean.slice(0, max);
  const lastDot = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return lastDot > max * 0.6 ? cut.slice(0, lastDot + 1) : cut + "...";
}
