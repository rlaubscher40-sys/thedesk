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
  if (!["realestate.com.au", "moneymanagement.com.au"].includes(host)) return null;
  const articleUrl = (value: unknown): boolean => {
    if (typeof value !== "string") return false;
    try {
      const parsed = new URL(value, sourceUrl);
      parsed.hash = "";
      const source = new URL(sourceUrl);
      source.hash = "";
      return parsed.href === source.href;
    } catch {
      return false;
    }
  };
  const promotedArticle = (value: unknown, depth = 0): boolean => {
    if (depth > 8 || !value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some((v) => promotedArticle(v, depth + 1));
    const row = value as Record<string, unknown>;
    const types = Array.isArray(row["@type"]) ? row["@type"] : [row["@type"]];
    const sections = Array.isArray(row.articleSection) ? row.articleSection : [row.articleSection];
    const entity = row.mainEntityOfPage;
    const entityId =
      entity && typeof entity === "object" ? (entity as Record<string, unknown>)["@id"] : entity;
    if (
      types.some((v) => ["Article", "NewsArticle", "BlogPosting"].includes(String(v))) &&
      [row.url, row["@id"], entityId].some(articleUrl) &&
      sections.some(
        (v) =>
          typeof v === "string" &&
          /^(?:promoted content|sponsored(?: content)?|advertorial)$/i.test(v.trim())
      )
    )
      return true;
    return promotedArticle(row["@graph"], depth + 1);
  };
  const nodes: DefaultTreeAdapterMap["node"][] = [parse(html.slice(0, 1024 * 1024))];
  while (nodes.length) {
    const node = nodes.pop()!;
    if (
      host === "moneymanagement.com.au" &&
      node.nodeName === "script" &&
      "attrs" in node &&
      node.attrs.some((a) => a.name === "type" && a.value === "application/ld+json") &&
      "childNodes" in node
    ) {
      try {
        const json = node.childNodes.map((n) => ("value" in n ? n.value : "")).join("");
        if (promotedArticle(JSON.parse(json))) return "publisher-disclosed-sponsored-content";
      } catch {
        /* Invalid publication metadata is held by the date check. */
      }
    }
    if (["script", "style", "template", "noscript"].includes(node.nodeName)) continue;
    if (
      host === "realestate.com.au" &&
      "attrs" in node &&
      node.attrs.some((a) => a.name === "data-testid" && a.value === "article-sponsored")
    )
      return "publisher-disclosed-sponsored-content";
    if ("childNodes" in node) nodes.push(...node.childNodes);
  }
  return null;
}
