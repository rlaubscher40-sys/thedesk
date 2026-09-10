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
        const title = cleanHeadline(plainText(text(node), 480));
        if (
          url.origin === new URL(source.url).origin &&
          source.articlePath &&
          new RegExp(source.articlePath).test(url.pathname) &&
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
