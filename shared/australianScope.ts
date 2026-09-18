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
  // Overseas publishers also cover Australia. Exclude a namesake only when
  // their country is explicit and the headline supplies no Australian anchor.
  if (
    /\b(Newcastle|Perth|Richmond|Windsor|Hamilton)\b/i.test(title) &&
    !/\b(Australia\w*|NSW|New South Wales|WA|Western Australia|QLD|Queensland|Victoria|Tasmania)\b/i.test(
      title
    )
  ) {
    if (
      /\b(?:Yahoo News UK|ChronicleLive|Chronicle Live|BBC|CBC|Canadian Broadcasting|The Scotsman|The Herald Scotland|(?:The )?Lanarkist)\b/i.test(
        publisher ?? ""
      )
    )
      return true;
    try {
      const host = new URL(sourceUrl ?? "").hostname;
      if (
        /(?:\.co\.uk|\.org\.uk|\.ca|\.co\.za)$|(?:^|\.)(?:chroniclelive|lanarkist)\.com$/i.test(
          host
        )
      )
        return true;
    } catch {
      /* Publisher identity may still be available for wrapped links. */
    }
  }
  return false;
}

/** A known namesake needs an Australian anchor. Google locale and the queried
 * market are not anchors. Callers must supply article text, never RSS roundups. */
export function unresolvedAustralianNamesake(
  title: string,
  summary: string,
  sourceUrl?: string | null,
  publisher?: string | null
): boolean {
  if (!/\b(?:Newcastle|Perth)\b/i.test(title + " " + summary)) return false;
  // Country-specific publisher labels survive Google wrappers. Treat these as
  // unresolved Australian evidence, not as proof of a particular foreign city.
  if (
    foreignHousingHeadline(
      title + " " + summary,
      publisher?.includes(".") ? `https://${publisher.trim()}` : sourceUrl,
      publisher
    )
  )
    return true;
  if (
    /\b(?:Perth|Newcastle)\b.{0,60}\b(?:Ontario|Scotland|England|South Africa)\b|\b(?:Ontario|Scotland|England|South Africa)\b.{0,60}\b(?:Perth|Newcastle)\b/i.test(
      title + " " + summary
    )
  )
    return true;
  if (
    /\b(?:Australia\w*|NSW|New South Wales|WA|Western Australia|QLD|Queensland|Sydney|Melbourne|Brisbane|Adelaide|Canberra|Hobart|Darwin)\b/i.test(
      title + " " + summary
    )
  )
    return false;
  if (
    /^(?:Newcastle Herald|The Newcastle Herald|The West Australian|PerthNow|WAtoday|ABS|Australian Bureau of Statistics|Australian Broadcasting Corporation|realestate\.com\.au(?: News)?|Domain|Australian Financial Review|The Australian|The Guardian Australia)$/i.test(
      publisher?.trim() ?? ""
    )
  )
    return false;
  try {
    const url = new URL(sourceUrl ?? "");
    if (
      /\.au$/i.test(url.hostname) ||
      (/(^|\.)theguardian\.com$/.test(url.hostname) && url.pathname.startsWith("/australia-news/"))
    )
      return false;
  } catch {
    /* An invalid source supplies no geography evidence. */
  }
  return true;
}
