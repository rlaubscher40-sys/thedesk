import { parse, type DefaultTreeAdapterMap } from "parse5";
import { newsTimestamp } from "../../../shared/propertyNewsQuality";
import type { SourceTiming } from "../../../shared/sourceTiming";
type Node = DefaultTreeAdapterMap["node"];
type PublicationDate = Pick<SourceTiming, "publisherPublishedAt" | "publisherDateStatus">;
export const missingPublicationDate: PublicationDate = {
  publisherPublishedAt: null,
  publisherDateStatus: "missing",
};

/** Metadata from the already-fetched page; never a second request or model call. */
export function extractPublicationDate(html: string): PublicationDate {
  const candidates: unknown[] = [];
  let invalid = false;
  let visited = 0;
  function jsonDates(value: unknown, depth = 0): void {
    if (depth > 8 || ++visited > 200) {
      invalid = true;
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => jsonDates(item, depth + 1));
      return;
    }
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
    if (
      types.some((type) =>
        [
          "Article",
          "NewsArticle",
          "BlogPosting",
          "ReportageNewsArticle",
          "AnalysisNewsArticle",
        ].includes(String(type))
      ) &&
      "datePublished" in item
    )
      candidates.push(item.datePublished);
    // Only document roots/graphs. Never promote dates from related stories,
    // comments, breadcrumbs or arbitrary nested objects to this article.
    if (item["@graph"]) jsonDates(item["@graph"], depth + 1);
  }
  const nodes: Node[] = [parse(html.slice(0, 512 * 1024))];
  while (nodes.length) {
    const node = nodes.pop()!;
    if ("tagName" in node) {
      const attrs = Object.fromEntries(node.attrs.map((a) => [a.name, a.value]));
      if (
        node.tagName === "meta" &&
        (attrs.property ?? attrs.name)?.toLowerCase() === "article:published_time"
      )
        candidates.push(attrs.content);
      if (node.tagName === "script" && attrs.type?.toLowerCase() === "application/ld+json") {
        const json = node.childNodes.map((n) => ("value" in n ? n.value : "")).join("");
        try {
          jsonDates(JSON.parse(json));
        } catch {
          invalid = true;
        }
      }
    }
    if ("childNodes" in node) for (const child of node.childNodes) nodes.push(child);
  }
  const dates = candidates.map((value) =>
    typeof value === "string" ? newsTimestamp(value) : null
  );
  if (invalid || dates.some((date) => date === null))
    return { publisherPublishedAt: null, publisherDateStatus: "invalid" };
  const distinct = [...new Set(dates)];
  if (distinct.length > 1)
    return { publisherPublishedAt: null, publisherDateStatus: "conflicting" };
  return distinct[0]
    ? { publisherPublishedAt: distinct[0], publisherDateStatus: "available" }
    : { ...missingPublicationDate };
}
