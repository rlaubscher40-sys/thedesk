/**
 * Tiny publisher favicon shown in a card's metadata bar, the visual trust
 * cue Perplexity uses on its Discover feed ("● ● ● 42 sources"). Derives the
 * domain from the story's source URL and pulls Google's favicon service;
 * falls back to a category-tinted letter disc when there's no usable URL or
 * the icon 404s, so the row never shows a broken-image glyph.
 *
 * Decorative — the source name sits right beside it — so it's aria-hidden.
 */
import { useState } from "react";

/** Pull a bare registrable-ish hostname out of a URL, dropping `www.`. */
export function faviconDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    // Google News redirect links don't represent the real publisher; until
    // the ingest resolves them, showing google's own favicon would be
    // misleading, so suppress it rather than mislabel the source.
    if (host === "news.google.com" || host === "google.com") return null;
    return host || null;
  } catch {
    return null;
  }
}

export function SourceFavicon({
  url,
  name,
  size = 14,
}: {
  url: string | null | undefined;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const domain = faviconDomain(url);
  const initial = name?.trim()?.[0]?.toUpperCase() ?? "·";

  const disc = (
    <span
      className="inline-flex items-center justify-center rounded-[3px] shrink-0 font-mono font-semibold text-[var(--color-fg-subtle)]"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.6,
        background: "var(--color-panel-tile-bg)",
        boxShadow: "inset 0 0 0 1px var(--color-border)",
      }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );

  if (!domain || failed) return disc;

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-[3px] object-contain"
      style={{ width: size, height: size }}
    />
  );
}
