/** Conservative editorial exclusion, not a global geocoder or automatic localisation. */
export function foreignHousingHeadline(title: string, sourceUrl?: string | null): boolean {
  if (
    /\b(?:US|U\.S\.?|USA|UK|NZ)\b/.test(title) ||
    /\b(United States|American|United Kingdom|Britain|British|England|London|New Zealand|Auckland|Canada|Canadian|Ontario|Ottawa|Scotland|Scottish|China|Chinese|Singapore|Hong Kong|Dubai|India|Indian)\b/i.test(
      title
    )
  )
    return true;
  // Disambiguate a known same-name town even when the headline omits Ontario.
  if (/\bPerth\b/i.test(title) && sourceUrl) {
    try {
      const host = new URL(sourceUrl).hostname;
      return /\.ca$/i.test(host) || /(^|\.)lanarkist\.com$/i.test(host);
    } catch {
      return false;
    }
  }
  return false;
}
