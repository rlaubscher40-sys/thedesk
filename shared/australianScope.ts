/** Conservative editorial exclusion, not a global geocoder or automatic localisation. */
export function foreignHousingHeadline(
  title: string,
  sourceUrl?: string | null,
  publisher?: string | null
): boolean {
  if (
    /\b(?:US|U\.S\.?|USA|UK|NZ)\b/.test(title) ||
    /\b(United States|American|United Kingdom|Britain|British|England|London|New Zealand|Auckland|Canada|Canadian|Ontario|Ottawa|Scotland|Scottish|China|Chinese|Singapore|Hong Kong|Dubai|India|Indian)\b/i.test(
      title
    )
  )
    return true;
  // Disambiguate a known same-name town even when the headline omits Ontario.
  // Aggregators hide the publisher's hostname, but retain its explicit name.
  if (
    /\bPerth\b/i.test(title) &&
    /^(CBC(?: News)?|Canadian Broadcasting Corporation|The Lanarkist|Lanarkist)$/i.test(
      publisher?.trim() ?? ""
    )
  )
    return true;
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
