import { parse, type DefaultTreeAdapterMap } from "parse5";
type Node = DefaultTreeAdapterMap["node"];
export const REIWA_RELEASE_SOURCE = "REIWA public releases (National Tribune)";

/** Public republication, not a proxy or independent confirmation. A topic tag
 * alone is insufficient: require the body attribution and original release
 * reference. Never fetch the denied origin through this route. */
export function isVerifiedReiwaRelease(html: string): boolean {
  let attribution = false;
  let reference = false;
  const text = (n: Node): string =>
    ("value" in n ? n.value : "") + ("childNodes" in n ? n.childNodes.map(text).join(" ") : "");
  const within = (node: Node, cls: string) => {
    let n: Node | null = node;
    while (n) {
      if (
        "attrs" in n &&
        n.attrs.some((a) => a.name === "class" && a.value.split(/\s+/).includes(cls))
      )
        return true;
      n = "parentNode" in n ? n.parentNode : null;
    }
    return false;
  };
  function visit(n: Node) {
    if ("attrs" in n) {
      const attrs = Object.fromEntries(n.attrs.map((a) => [a.name, a.value]));
      if (
        (attrs.class ?? "").split(/\s+/).includes("caption") &&
        within(n, "main-article-body") &&
        text(n).trim() === "REIWA"
      )
        attribution = true;
      if (n.nodeName === "a" && within(n, "shim-detail")) {
        try {
          const url = new URL(attrs.href ?? attrs.dhref ?? "");
          if (
            url.protocol === "https:" &&
            ["reiwa.com.au", "www.reiwa.com.au"].includes(url.hostname) &&
            !url.username &&
            !url.password &&
            !url.port &&
            /^\/news\/[^/]+\/$/.test(url.pathname)
          )
            reference = true;
        } catch {
          /* Not a verified original reference. */
        }
      }
    }
    if ("childNodes" in n) n.childNodes.forEach(visit);
  }
  visit(parse(html));
  return attribution && reference;
}
