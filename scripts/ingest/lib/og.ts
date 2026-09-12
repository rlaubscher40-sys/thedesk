/** Extract a source image from the HTML already retrieved by the article reader. */
const OG_PATTERNS = [
  /<meta\s+[^>]*property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["'][^>]*>/i,
  /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["'][^>]*>/i,
  /<meta\s+[^>]*name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["'][^>]*>/i,
  /<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["'][^>]*>/i,
];

/** Pull the first usable og:image / twitter:image URL out of a chunk of
 *  HTML. Shared with the full-article fetcher so both code paths agree on
 *  what counts as a valid image. */
export function pickOgImage(html: string): string | null {
  for (const pattern of OG_PATTERNS) {
    const m = html.match(pattern);
    if (m && m[1]) {
      const candidate = m[1].trim();
      if (/^https?:\/\//i.test(candidate)) return candidate;
      if (candidate.startsWith("//")) return "https:" + candidate;
    }
  }
  return null;
}
