/**
 * Fetches an article page once and returns BOTH the og:image and the
 * extracted body text. This replaces the old image-only scrape: the daily
 * feed previously threw the article body away and enriched every story from
 * the 480-char RSS snippet alone, so "why it matters" / "say this" / partner
 * angles were written from the headline rather than the actual reporting.
 *
 * Extraction is deliberately dependency-free (no cheerio / readability):
 *   - strip <script>/<style>/<noscript>/comments so we don't read junk
 *   - prefer the semantic <article> or <main> container when present, which
 *     drops nav bars, sidebars and related-link rails
 *   - mine <p> blocks for the body, since news copy lives in paragraphs and
 *     this skips menus, buttons and one-line captions
 *   - fall back to a blanket tag-strip if a site builds paragraphs from divs
 *
 * Times out fast and returns nulls on any failure, the caller falls back to
 * the gradient placeholder for the image and to the RSS summary for context.
 */
import { DEFAULT_SITE_URL } from "../../../shared/const";
import { decodeEntities, stripHtml } from "./text";
import { pickOgImage } from "./og";

const SITE_URL = process.env.SITE_URL ?? DEFAULT_SITE_URL;

export type FetchedArticle = {
  imageUrl: string | null;
  text: string | null;
};

function matchFirst(s: string, re: RegExp): string | null {
  const m = s.match(re);
  return m && m[1] ? m[1] : null;
}

/** Pull readable body text out of raw article HTML, capped at `maxChars`. */
export function extractArticleText(html: string, maxChars: number): string | null {
  const cleaned = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // Prefer a semantic container, the article body lives here on most news
  // sites and this strips chrome (nav, footer, "more stories" rails).
  const container =
    matchFirst(cleaned, /<article\b[^>]*>([\s\S]*?)<\/article>/i) ??
    matchFirst(cleaned, /<main\b[^>]*>([\s\S]*?)<\/main>/i) ??
    cleaned;

  const paras: string[] = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(container)) !== null) {
    const txt = decodeEntities(stripHtml(m[1] ?? "")).trim();
    // Drop scraps: share prompts, captions, bylines, single words.
    if (txt.length >= 40) paras.push(txt);
  }

  let text = paras.join("\n\n").trim();
  // Some sites assemble paragraphs from <div>s. Only fall back to a blanket
  // tag-strip when <p> mining found nothing usable, if it found even one real
  // paragraph we trust it, otherwise the fallback re-admits the nav/caption
  // scraps the paragraph pass just filtered out.
  if (paras.length === 0) {
    text = decodeEntities(stripHtml(container)).trim();
  }
  if (!text) return null;

  if (text.length > maxChars) {
    const cut = text.slice(0, maxChars);
    const lastDot = cut.lastIndexOf(". ");
    text = lastDot > maxChars * 0.6 ? cut.slice(0, lastDot + 1) : cut + "...";
  }
  return text;
}

export async function fetchArticle(
  url: string,
  {
    timeoutMs = 6_000,
    maxBytes = 500 * 1024,
    maxChars = 6_000,
  }: { timeoutMs?: number; maxBytes?: number; maxChars?: number } = {}
): Promise<FetchedArticle> {
  const empty: FetchedArticle = { imageUrl: null, text: null };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": `Mozilla/5.0 (compatible; TheDeskBot/1.0; +${SITE_URL})`,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return empty;

    // Read up to maxBytes, the og tags sit in <head> (early) and most news
    // bodies fit comfortably inside 500KB. Unlike the image-only scrape we
    // can't stop at </head>, the body is what we're here for.
    const reader = res.body?.getReader();
    if (!reader) return empty;
    const decoder = new TextDecoder();
    let html = "";
    let received = 0;
    while (received < maxBytes) {
      const { value, done } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      received += value.byteLength;
    }
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }

    return {
      imageUrl: pickOgImage(html),
      text: extractArticleText(html, maxChars),
    };
  } catch {
    return empty;
  }
}
