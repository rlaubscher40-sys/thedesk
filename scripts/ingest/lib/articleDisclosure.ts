import { parse, type DefaultTreeAdapterMap } from "parse5";

/** Publisher-declared commercial content is not editorial evidence. Match
 * rendered article markup, never CSS definitions, script strings, footer ads
 * or a newsroom's discussion of sponsorship. */
export function articleDisclosureHold(html: string, sourceUrl: string): string | null {
  let host: string;
  try {
    host = new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (host !== "realestate.com.au") return null;
  const nodes: DefaultTreeAdapterMap["node"][] = [parse(html.slice(0, 1024 * 1024))];
  while (nodes.length) {
    const node = nodes.pop()!;
    if (["script", "style", "template", "noscript"].includes(node.nodeName)) continue;
    if (
      "attrs" in node &&
      node.attrs.some((a) => a.name === "data-testid" && a.value === "article-sponsored")
    )
      return "publisher-disclosed-sponsored-content";
    if ("childNodes" in node) nodes.push(...node.childNodes);
  }
  return null;
}
