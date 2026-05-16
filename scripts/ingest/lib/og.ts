/**
 * Fetches the article HTML and extracts og:image / twitter:image. No deps —
 * a regex pass against the <head> block is enough for ~95% of news sites
 * and avoids pulling cheerio just for one selector.
 *
 * Times out fast (4s) and returns null on any failure — the caller falls
 * back to the category-tinted gradient placeholder.
 */
import { DEFAULT_SITE_URL } from "../../../shared/const";

const SITE_URL = process.env.SITE_URL ?? DEFAULT_SITE_URL;

const OG_PATTERNS = [
  /<meta\s+[^>]*property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["'][^>]*>/i,
  /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["'][^>]*>/i,
  /<meta\s+[^>]*name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["'][^>]*>/i,
  /<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["'][^>]*>/i,
];

export async function fetchOgImage(url: string, timeoutMs = 4_000): Promise<string | null> {
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
    if (!res.ok) return null;
    // Only read the first ~80KB — og tags live in <head>.
    const reader = res.body?.getReader();
    if (!reader) return null;
    const decoder = new TextDecoder();
    let html = "";
    let received = 0;
    const cap = 80 * 1024;
    while (received < cap) {
      const { value, done } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      received += value.byteLength;
      if (html.includes("</head>")) break;
    }
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
    for (const pattern of OG_PATTERNS) {
      const m = html.match(pattern);
      if (m && m[1]) {
        const candidate = m[1].trim();
        if (/^https?:\/\//i.test(candidate)) return candidate;
        if (candidate.startsWith("//")) return "https:" + candidate;
      }
    }
    return null;
  } catch {
    return null;
  }
}
