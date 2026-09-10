import { parse, serialize, type DefaultTreeAdapterMap } from "parse5";
type Node = DefaultTreeAdapterMap["node"];
const excluded = new Set(["script", "style", "noscript", "template", "nav", "aside", "footer", "form", "figure", "figcaption"]);
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
export function readableText(html: string): string {
  const chunks: string[] = [];
  function collect(node: Node) {
    if ("value" in node) chunks.push(node.value);
    if ("childNodes" in node) node.childNodes.forEach(collect);
  }
  collect(documentWithoutInactiveContent(html));
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}
