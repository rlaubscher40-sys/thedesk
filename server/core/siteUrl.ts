/**
 * The site's one canonical public address.
 *
 * Never derive this from Host / x-forwarded-host: sitemap, RSS and
 * canonical URLs are served with `Cache-Control: public`, so a poisoned
 * Host header could be cached by an intermediary and served to real
 * crawlers. Config or the hard default, nothing request-controlled.
 */
import { DEFAULT_SITE_URL } from "../../shared/const";

export function siteUrl(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  return DEFAULT_SITE_URL;
}

/** Hostname of {@link siteUrl}, lowercased, no port. `thedesk.au`. */
export function siteHost(): string {
  try {
    return new URL(siteUrl()).hostname.toLowerCase();
  } catch {
    return new URL(DEFAULT_SITE_URL).hostname.toLowerCase();
  }
}
