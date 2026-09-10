import { parse, type DefaultTreeAdapterMap } from "parse5";
import { cleanHeadline } from "../../../shared/headline";
import { plainText } from "./text";
import type { Source } from "../sources";
import type { FetchedItem } from "./rss";
type Node = DefaultTreeAdapterMap["node"];
function text(node: Node): string {
  if (["script", "style", "noscript", "template"].includes(node.nodeName)) return "";
  return (
    ("value" in node ? node.value : "") +
    ("childNodes" in node ? node.childNodes.map(text).join(" ") : "")
  );
}
function heading(node: Node): string | null {
  if (/^h[1-6]$/.test(node.nodeName)) return text(node);
  if ("childNodes" in node)
    for (const child of node.childNodes) {
      const title = heading(child);
      if (title?.trim()) return title;
    }
  return null;
}
function inArticleContainer(node: Node, requiredClass?: string): boolean {
  if (!requiredClass) return true;
  let ancestor: Node | null = node;
  while (ancestor) {
    if (
      "attrs" in ancestor &&
      ancestor.attrs.some((a) => a.name === "class" && a.value.split(/\s+/).includes(requiredClass))
    )
      return true;
    ancestor = "parentNode" in ancestor ? ancestor.parentNode : null;
  }
  return false;
}
/** Same-origin, explicitly configured article paths only. Index discovery never
 * invents a publication timestamp; the article must supply it before selection. */
export function parseIndexSource(html: string, source: Source): FetchedItem[] {
  const root = parse(html);
  const links = new Map<string, FetchedItem>();
  function visit(node: Node) {
    if ("tagName" in node && node.tagName === "a") {
      const attrs = Object.fromEntries(node.attrs.map((a) => [a.name, a.value]));
      try {
        const url = new URL(attrs.href ?? "", source.url);
        // Cards often wrap a category, headline and "Read now" in one link.
        // Only the headline may establish the article's subject.
        const title = cleanHeadline(plainText(heading(node) ?? text(node), 480));
        if (
          url.origin === new URL(source.url).origin &&
          source.articlePath &&
          new RegExp(source.articlePath).test(url.pathname) &&
          inArticleContainer(node, source.articleContainerClass) &&
          title.length >= 18 &&
          !links.has(url.href)
        )
          links.set(url.href, {
            title,
            summary: "",
            url: url.href,
            source: source.name,
            category: source.category,
            channel: source.channel,
            imageUrl: null,
            isoDate: null,
            discovery: "publisher-index",
          });
      } catch {
        /* Not an article URL. */
      }
    }
    if ("childNodes" in node) node.childNodes.forEach(visit);
  }
  visit(root);
  return [...links.values()].slice(0, source.maxItems ?? 16);
}
