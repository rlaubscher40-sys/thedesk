/** Resolve only explicit publisher identities; a Google wrapper is not a
 * publisher and two unrecognised labels do not establish independent ownership. */
const PUBLISHER_HOSTS: Record<string, string> = {
  "australian broadcasting corporation": "abc.net.au",
  "newcastle herald": "newcastleherald.com.au",
  "the newcastle herald": "newcastleherald.com.au",
  "the west australian": "thewest.com.au",
  perthnow: "perthnow.com.au",
  watoday: "watoday.com.au",
  "realestate.com.au": "realestate.com.au",
  "realestate.com.au news": "realestate.com.au",
  domain: "domain.com.au",
  "the guardian": "theguardian.com",
  "the guardian australia": "theguardian.com",
  "australian financial review": "afr.com",
  "the australian": "theaustralian.com.au",
};
export function sourceWebsite(sourceUrl: string | null, publisher: string | null): string | null {
  try {
    const url = new URL(sourceUrl ?? "");
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "news.google.com") return host;
    return PUBLISHER_HOSTS[publisher?.trim().toLowerCase() ?? ""] ?? null;
  } catch {
    return null;
  }
}
