import { extractPublicationDate, missingPublicationDate } from "./publicationDate";
import type { SourceTiming } from "../../../shared/sourceTiming";
import { publicFetch } from "./publicFetch";
import { readableArticleHtml } from "./htmlText";
import { articleDisclosureHold } from "./articleDisclosure";
import { extractResearchPdf, isResearchPdfUrl } from "./researchPdf";
import { extractMarketClose, isAbcMarketLiveblog } from "./marketLiveblog";
/**
 * Fetches an article page once and returns BOTH the og:image and the
 * extracted body text. This replaces the old image-only scrape: the daily
 * feed previously threw the article body away and enriched every story from
 * the 480-char RSS snippet alone, so "why it matters" / "say this" / partner
 * angles were written from the headline rather than the actual reporting.
 *
 * Extraction uses an HTML5 parser before paragraph selection:
 *   - strip <script>/<style>/<noscript>/comments so we don't read junk
 *   - prefer the semantic <article> or <main> container when present, which
 *     drops nav bars, sidebars and related-link rails
 *   - mine <p> blocks for the body, since news copy lives in paragraphs and
 *     this skips menus, buttons and one-line captions
 *   - fall back to a blanket tag-strip if a site builds paragraphs from divs
 *
 * Times out fast and returns nulls on any failure, the caller falls back to
 * the gradient placeholder for the image. Briefing selection holds missing text.
 */
import { DEFAULT_SITE_URL } from "../../../shared/const";
import { looksLikeGarbage, looksLikeSiteBoilerplate } from "../../../shared/headline";
import { decodeEntities, stripHtml } from "./text";
import { pickOgImage } from "./og";

const SITE_URL = process.env.SITE_URL ?? DEFAULT_SITE_URL;

export type FetchedArticle = {
  title?: string;
  editorialHold?: string | null;
  imageUrl: string | null;
  text: string | null;
  publicationDate: Pick<
    SourceTiming,
    "publisherPublishedAt" | "publisherPublishedDay" | "publisherDateStatus"
  >;
};

/** Pull readable body text out of raw article HTML, capped at `maxChars`. */
export function extractArticleText(html: string, maxChars: number): string | null {
  const container = readableArticleHtml(html);

  const paras: string[] = [];
  // Research releases often put their actual findings in lists. Retain those
  // within the same cleaned article container, not just surrounding prose.
  const re = /<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(container)) !== null) {
    const txt = decodeEntities(stripHtml(m[2] ?? "")).trim();
    // Drop scraps: share prompts, captions, bylines, single words.
    if (txt.length >= 40 && !looksLikeSiteBoilerplate(txt) && !looksLikeGarbage(txt))
      paras.push(txt);
  }

  let text = paras.join("\n\n").trim();
  // Some sites assemble paragraphs from <div>s. Only fall back to a blanket
  // tag-strip when <p> mining found nothing usable, if it found even one real
  // paragraph we trust it, otherwise the fallback re-admits the nav/caption
  // scraps the paragraph pass just filtered out.
  if (paras.length === 0) {
    text = decodeEntities(stripHtml(container)).trim();
    if (looksLikeSiteBoilerplate(text) || looksLikeGarbage(text)) return null;
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
    maxBytes = 1024 * 1024,
    maxChars = 6_000,
  }: { timeoutMs?: number; maxBytes?: number; maxChars?: number } = {}
): Promise<FetchedArticle> {
  const empty: FetchedArticle = {
    imageUrl: null,
    text: null,
    publicationDate: { ...missingPublicationDate },
  };
  const controller = new AbortController();
  // Keep the budget alive through the body, not just the response headers.
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const res = await publicFetch(url, {
      maxBytes: (isResearchPdfUrl(url) ? 2 : 5) * 1024 * 1024,
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": `Mozilla/5.0 (compatible; TheDeskBot/1.0; +${SITE_URL})`,
        Accept: "text/html,application/xhtml+xml,application/pdf",
      },
    });
    if (!res.ok) return empty;
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (contentType === "application/pdf" && isResearchPdfUrl(url)) {
      const result = await extractResearchPdf(new Uint8Array(await res.arrayBuffer()), url, {
        maxChars,
      });
      return { imageUrl: null, ...result };
    }
    if (!["text/html", "application/xhtml+xml"].includes(contentType)) {
      await res.body?.cancel();
      return empty;
    }

    // Read up to maxBytes, the og tags sit in <head> (early) and most news
    // bodies fit inside the bounded 1MB extraction budget. Unlike the image-only scrape we
    // can't stop at </head>, the body is what we're here for.
    reader = res.body?.getReader();
    if (!reader) return empty;
    const decoder = new TextDecoder();
    let html = "";
    let received = 0;
    while (received < maxBytes) {
      const { value, done } = await reader.read();
      if (done) break;
      // A single incoming chunk can exceed the entire limit. Decode only the
      // allowed prefix so the configured cap bounds retained HTML exactly.
      const chunk = value.subarray(0, maxBytes - received);
      html += decoder.decode(chunk, { stream: true });
      received += chunk.byteLength;
    }
    html += decoder.decode();

    const editorialHold = articleDisclosureHold(html, url);
    if (editorialHold) return { ...empty, editorialHold };

    if (isAbcMarketLiveblog(url)) {
      const close = extractMarketClose(html, url);
      if (!close) return { ...empty, editorialHold: "market-liveblog-without-dated-close" };
      return {
        title: close.title,
        text: close.text,
        imageUrl: pickOgImage(html),
        publicationDate: {
          publisherDateStatus: "available",
          publisherPublishedAt: close.publishedAt,
        },
      };
    }

    return {
      publicationDate: extractPublicationDate(html, url),
      imageUrl: pickOgImage(html),
      text: extractArticleText(html, maxChars),
    };
  } catch {
    return empty;
  } finally {
    clearTimeout(timer);
    try {
      await reader?.cancel();
    } catch {
      /* an aborted stream is already closed */
    }
  }
}
