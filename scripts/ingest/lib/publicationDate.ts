import { parse, type DefaultTreeAdapterMap } from "parse5";
import { newsTimestamp } from "../../../shared/propertyNewsQuality";
import type { SourceTiming } from "../../../shared/sourceTiming";
type Node = DefaultTreeAdapterMap["node"];
type PublicationDate = Pick<SourceTiming, "publisherPublishedAt" | "publisherPublishedDay" | "publisherDateStatus">;
export const missingPublicationDate: PublicationDate = {
  publisherPublishedAt: null,
  publisherDateStatus: "missing",
};

/** Metadata from the already-fetched page; never a second request or model call. */
export function extractPublicationDate(html: string): PublicationDate {
  const candidates: unknown[] = [];
  const days: string[] = [];
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
      // ABS visibly labels its original release day. Preserve day precision;
      // do not manufacture a publication time from the collection clock.
      if ((attrs.class ?? "").split(/\s+/).includes("field--name-dynamic-twig-fieldnode-release-or-orig-publish")) {
        const collect = (n: Node): string => ("value" in n ? n.value : "") + ("childNodes" in n ? n.childNodes.map(collect).join(" ") : "");
        const match = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/.exec(collect(node));
        if (match) days.push(`${match[3]}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}`);
      }
      // Explicit publisher time in the article header (e.g. RBA interviews).
      // A timezone is mandatory; an event date without a time is not invented.
      if (node.tagName === "time" && attrs.datetime &&
          (attrs.itemprop === "datePublished" || ("parentNode" in node && node.parentNode && "attrs" in node.parentNode && node.parentNode.attrs.some(a => a.name === "itemprop" && a.value === "datePublished"))))
        candidates.push(attrs.datetime);
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
  // Publishers sometimes expose a day, a local time without a timezone, or
  // two conflicting clocks for the same calendar day. Retain only the
  // precision all declarations support; never choose or invent a clock.
  const parsed = candidates.map(value => {
    if (typeof value !== "string") return null;
    const timestamp = newsTimestamp(value);
    const literal = /^(\d{4}-\d{2}-\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(value);
    const day = literal?.[1];
    if (!timestamp && !day) return null;
    if (day) {
      const calendar = new Date(`${day}T00:00:00Z`);
      if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== day) return null;
      // Reject malformed clocks even when the calendar portion is valid.
      if (value.length > 10 && !timestamp && !Number.isFinite(Date.parse(value.replace(" ", "T") + "Z"))) return null;
    }
    return { timestamp, day };
  });
  if (invalid || parsed.some(value => !value)) return { publisherPublishedAt: null, publisherDateStatus: "invalid" };
  const values = parsed.filter((value): value is NonNullable<typeof value> => !!value);
  const timestamps = [...new Set(values.map(value => value.timestamp))];
  if (timestamps.length === 1 && timestamps[0] && !days.length)
    return { publisherPublishedAt: timestamps[0], publisherDateStatus: "available" };
  const declaredDays = [...days, ...values.map(value => value.day)];
  const uniqueDays = [...new Set(declaredDays)];
  if (uniqueDays.length === 1 && uniqueDays[0]) {
    const day = uniqueDays[0];
    const calendar = new Date(`${day}T00:00:00Z`);
    if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== day) return { publisherPublishedAt: null, publisherDateStatus: "invalid" };
    return { publisherPublishedAt: null, publisherPublishedDay: day, publisherDateStatus: "available" };
  }
  if (values.length || days.length) return { publisherPublishedAt: null, publisherDateStatus: "conflicting" };
  return { ...missingPublicationDate };
}
