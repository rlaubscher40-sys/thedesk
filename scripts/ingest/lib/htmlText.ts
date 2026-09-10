import { parse, serialize, type DefaultTreeAdapterMap } from "parse5";
type Node = DefaultTreeAdapterMap["node"];
const excluded = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "nav",
  "aside",
  "footer",
  "form",
  "figure",
  "figcaption",
]);
function documentWithoutInactiveContent(html: string) {
  const document = parse(html);
  function prune(node: Node) {
    if (!("childNodes" in node)) return;
    node.childNodes = node.childNodes.filter(
      (child) =>
        child.nodeName !== "#comment" && !("tagName" in child && excluded.has(child.tagName))
    );
    node.childNodes.forEach(prune);
  }
  prune(document);
  return document;
}
/** Text extraction only, never an HTML sanitizer for browser rendering. */
export function readableHtml(html: string): string {
  return serialize(documentWithoutInactiveContent(html));
}
/** Serialize a complete DOM container. A closing-tag regex truncates nested
 * article sections (for example Housing Australia's introduction/body cards). */
export function readableArticleHtml(html: string): string {
  const document = documentWithoutInactiveContent(html);
  function find(node: Node, name: string): DefaultTreeAdapterMap["element"] | null {
    if ("tagName" in node && node.tagName === name) return node;
    if ("childNodes" in node)
      for (const child of node.childNodes) {
        const found = find(child, name);
        if (found) return found;
      }
    return null;
  }
  return serialize(find(document, "article") ?? find(document, "main") ?? document);
}
export function readableText(html: string): string {
  const chunks: string[] = [];
  function collect(node: Node) {
    if ("value" in node) chunks.push(node.value);
    if ("childNodes" in node) node.childNodes.forEach(collect);
  }
  collect(documentWithoutInactiveContent(html));
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}
