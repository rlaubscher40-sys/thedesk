import { parse, type DefaultTreeAdapterMap } from "parse5";
import { editorialToday } from "../../../shared/editorialTiming";
import { plainText } from "./text";

export type MarketClose = { title: string; text: string; publishedAt: string };
/** Only the publisher's dated closing post, never the rolling page's newest
 * paragraph, modified date, search excerpt or an overseas-market update. */
export function extractMarketClose(
  html: string,
  url: string,
  now = new Date()
): MarketClose | null {
  const page = new URL(url);
  if (
    page.hostname !== "www.abc.net.au" ||
    !/\/asx-markets-business-news-live-updates\//.test(page.pathname)
  )
    return null;
  const pageDay = page.pathname.match(/\/news\/(20\d{2}-\d{2}-\d{2})\//)?.[1];
  const scripts: string[] = [];
  function walk(node: DefaultTreeAdapterMap["node"]) {
    if (
      "tagName" in node &&
      node.tagName === "script" &&
      node.attrs.some((a) => a.name === "type" && a.value === "application/ld+json")
    ) {
      scripts.push(node.childNodes.map((n) => ("value" in n ? n.value : "")).join(""));
      return;
    }
    if ("childNodes" in node) node.childNodes.forEach(walk);
  }
  walk(parse(html));
  const updates: MarketClose[] = [];
  for (const script of scripts) {
    let parsed: any;
    try {
      parsed = JSON.parse(script);
    } catch {
      continue;
    }
    const roots = Array.isArray(parsed)
      ? parsed
      : [parsed, ...(Array.isArray(parsed?.["@graph"]) ? parsed["@graph"] : [])];
    for (const blog of roots) {
      if (blog?.["@type"] !== "LiveBlogPosting" || !Array.isArray(blog.liveBlogUpdate)) continue;
      for (const post of blog.liveBlogUpdate.slice(0, 250)) {
        if (
          post?.["@type"] !== "BlogPosting" ||
          typeof post.headline !== "string" ||
          typeof post.articleBody !== "string" ||
          typeof post.datePublished !== "string"
        )
          continue;
        const title = plainText(post.headline, 400);
        if (
          !/\b(?:ASX(?: 200)?|Australian (?:share|stock) market)\b.{0,50}\b(?:clos(?:es|ed)|ends?|finished)\b/i.test(
            title
          )
        )
          continue;
        if (/\b(?:will|expected|set to|could)\b/i.test(title)) continue;
        const date = new Date(post.datePublished);
        if (!Number.isFinite(date.getTime()) || date > now || editorialToday(date) !== pageDay)
          continue;
        const clock = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Australia/Sydney",
          hour: "2-digit",
          hourCycle: "h23",
        }).format(date);
        if (Number(clock) < 16) continue;
        try {
          const postUrl = new URL(post.url ?? post["@id"]);
          if (postUrl.origin !== page.origin || postUrl.pathname !== page.pathname || !postUrl.hash)
            continue;
        } catch {
          continue;
        }
        const body = plainText(post.articleBody, 5500);
        if (
          body.length < 650 ||
          !/\b(?:Australian share market|ASX)\b/i.test(body) ||
          !/\b(?:clos(?:ed|e)|finished|ended)\b/i.test(body) ||
          !/\d/.test(body)
        )
          continue;
        // The date stays in the opening paragraph, including the feed summary.
        updates.push({
          title: `${title} · ${pageDay}`,
          text: `Market close on ${pageDay}: ${body}`,
          publishedAt: date.toISOString(),
        });
      }
    }
  }
  return updates.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0] ?? null;
}

export function isAbcMarketLiveblog(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "www.abc.net.au" &&
      /\/asx-markets-business-news-live-updates\//.test(u.pathname)
    );
  } catch {
    return false;
  }
}
