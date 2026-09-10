/** Geography is about the reported event, never the generated Australian angle. */
export type GeographyStory = {
  title: string;
  summary?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  url?: string | null;
  category?: string | null;
  channel?: string | null;
};

const AUSTRALIAN = /\b(australia(?:n|ns)?|aussies?|sydney|melbourne|brisbane|adelaide|canberra|hobart|darwin|queensland|tasmania|new south wales|south australia|western australia|northern territory|nsw|geelong|townsville|cairns|toowoomba|ballarat|bendigo|launceston|rockhampton|wollongong|gold coast|sunshine coast|rba|apra|asic|ato|asx|superannuation|smsf|albanese)\b/i;
// Explicit overseas subjects. Do not match ordinary English "us", US-dollar
// prices ($US100), or ambiguous standalone places such as Perth or Victoria.
const FOREIGN = /\b(united states|america(?:n|ns)?|UK|U\.K\.|britain|british|england|london|scotland|scottish|new zealand|auckland|canada|canadian|toronto|vancouver|china|chinese|beijing|india|indian|mumbai|delhi|japan|japanese|tokyo|europe|european|germany|german|france|french|iran|iranian|iranians|iraq|iraqi|israel|israeli|trump|federal reserve|ecb|bank of england|bank of japan|wall street|s&p 500|nasdaq|dow jones|new york|california|florida|texas|san diego|los angeles|401\(k\))\b/i;

function foreignHeadline(title: string): boolean {
  const text = title.replace(/\$US\d[\d,.]*/g, "");
  return /\b(?:US|USA)\b(?!\d)|\bU\.S\.(?=\W|$)|\bFed\b(?! up\b)/.test(text) || FOREIGN.test(text);
}

function domesticSource(input: GeographyStory): boolean {
  try {
    const url = new URL(input.sourceUrl ?? input.url ?? "");
    if (url.hostname.endsWith(".gov.au")) return true;
    return /(^|\.)theguardian\.com$/.test(url.hostname) &&
      /^\/australia-news\//.test(url.pathname);
  } catch {
    return false;
  }
}

function coverageChannel(category: string | null | undefined): string {
  if (["PROPERTY", "MACRO", "MARKETS", "ECONOMICS", "POLICY"].includes(category ?? ""))
    return "BUSINESS";
  if (["AI", "TECH", "SCIENCE"].includes(category ?? "")) return "TECH";
  return "GLOBAL";
}

/** Historical repair is deliberately limited to clearly overseas stories.
 * Unknown old headlines are preserved; a lack of evidence is not proof. */
export function isClearlyOverseas(input: GeographyStory): boolean {
  if (AUSTRALIAN.test(input.title)) return false;
  return foreignHeadline(input.title) ||
    /^Global · (Central banks|Markets & rates|US property & mortgage)$/.test(input.source ?? "");
}

/** Run on publisher title/summary before enrichment. An overseas headline
 * needs an Australian subject in that headline, not a comparison underneath.
 * A mixed/Australian publisher or Google AU locale alone proves nothing. */
export function storyChannel(input: GeographyStory): string {
  const channel = (input.channel ?? "AU").toUpperCase();
  if (!["AU", "PROPERTY"].includes(channel)) return channel;
  if (isClearlyOverseas(input)) return coverageChannel(input.category);
  if (AUSTRALIAN.test(input.title) || AUSTRALIAN.test(input.summary ?? "") || domesticSource(input))
    return channel;
  return coverageChannel(input.category);
}

export function routeStory<T extends GeographyStory>(item: T): T & { channel: string } {
  return { ...item, channel: storyChannel(item) };
}
