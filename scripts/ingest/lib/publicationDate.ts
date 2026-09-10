import { parse, type DefaultTreeAdapterMap } from "parse5";
import { newsTimestamp } from "../../../shared/propertyNewsQuality";
import type { SourceTiming } from "../../../shared/sourceTiming";
type Node = DefaultTreeAdapterMap["node"];
type PublicationDate = Pick<
  SourceTiming,
  "publisherPublishedAt" | "publisherPublishedDay" | "publisherDateStatus"
>;
export const missingPublicationDate: PublicationDate = {
  publisherPublishedAt: null,
  publisherDateStatus: "missing",
};

/** Metadata from the already-fetched page; never a second request or model call. */
export function extractPublicationDate(html: string, sourceUrl?: string): PublicationDate {
  const candidates: unknown[] = [];
  const days: string[] = [];
  let invalid = false;
  let visited = 0;
  let host = "";
  try {
    host = new URL(sourceUrl ?? "").hostname.replace(/^www\./, "");
  } catch {
    /* generic metadata only */
  }
  const collect = (n: Node): string =>
    ("value" in n ? n.value : "") + ("childNodes" in n ? n.childNodes.map(collect).join(" ") : "");
  function namedDay(value: string) {
    const match =
      /^(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December) (20\d{2})$/.exec(
        value.trim()
      );
    if (!match) {
      invalid = true;
      return;
    }
    const month =
      [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ].indexOf(match[2]!) + 1;
    days.push(`${match[3]}-${String(month).padStart(2, "0")}-${match[1]!.padStart(2, "0")}`);
  }
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
  // APRA's explicit publication label follows a large navigation document.
  // Use the same bounded 1MB retained-page budget as article extraction.
  const nodes: Node[] = [parse(html.slice(0, 1024 * 1024))];
  while (nodes.length) {
    const node = nodes.pop()!;
    if ("tagName" in node) {
      const attrs = Object.fromEntries(node.attrs.map((a) => [a.name, a.value]));
      if (host === "ahuri.edu.au" && (attrs.class ?? "").split(/\s+/).includes("page-date")) {
        const months: Record<string, string> = {
          Jan: "January",
          Feb: "February",
          Mar: "March",
          Apr: "April",
          May: "May",
          Jun: "June",
          Jul: "July",
          Aug: "August",
          Sep: "September",
          Oct: "October",
          Nov: "November",
          Dec: "December",
        };
        namedDay(
          collect(node)
            .trim()
            .replace(/\b[A-Z][a-z]{2}\b/, (month) => months[month] ?? month)
        );
      }
      if (
        host === "ministers.treasury.gov.au" &&
        node.tagName === "meta" &&
        attrs.name === "dcterms.date"
      )
        namedDay(attrs.content ?? "");
      if (
        host === "apra.gov.au" &&
        (attrs.class ?? "").split(/\s+/).includes("anx-pill--split") &&
        "childNodes" in node
      ) {
        const children = node.childNodes.filter((child) => "attrs" in child);
        const label = children.find(
          (child) =>
            "attrs" in child &&
            child.attrs.some(
              (a) => a.name === "class" && a.value.split(/\s+/).includes("anx-pill__label-first")
            )
        );
        const value = children.find(
          (child) =>
            "attrs" in child &&
            child.attrs.some(
              (a) => a.name === "class" && a.value.split(/\s+/).includes("anx-pill__label-last")
            )
        );
        if (label && value && collect(label).trim() === "Published") namedDay(collect(value));
      }
      if (
        node.tagName === "meta" &&
        (attrs.property ?? attrs.name)?.toLowerCase() === "article:published_time"
      )
        candidates.push(attrs.content);
      // ABS visibly labels its original release day. Preserve day precision;
      // do not manufacture a publication time from the collection clock.
      if (
        (attrs.class ?? "")
          .split(/\s+/)
          .includes("field--name-dynamic-twig-fieldnode-release-or-orig-publish")
      ) {
        const match = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/.exec(collect(node));
        if (match)
          days.push(`${match[3]}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}`);
      }
      // Explicit publisher time in the article header (e.g. RBA interviews).
      // A timezone is mandatory; an event date without a time is not invented.
      if (
        node.tagName === "time" &&
        attrs.datetime &&
        (attrs.itemprop === "datePublished" ||
          ("parentNode" in node &&
            node.parentNode &&
            "attrs" in node.parentNode &&
            node.parentNode.attrs.some(
              (a) => a.name === "itemprop" && a.value === "datePublished"
            )))
      )
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
  const parsed = candidates.map((value) => {
    if (typeof value !== "string") return null;
    const timestamp = newsTimestamp(value);
    const literal =
      /^(\d{4}-\d{2}-\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(
        value
      );
    const day = literal?.[1];
    if (!timestamp && !day) return null;
    if (day) {
      const calendar = new Date(`${day}T00:00:00Z`);
      if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== day)
        return null;
      // Reject malformed clocks even when the calendar portion is valid.
      if (
        value.length > 10 &&
        !timestamp &&
        !Number.isFinite(Date.parse(value.replace(" ", "T") + "Z"))
      )
        return null;
    }
    // NSW's visible day is Sydney-local; its JSON-LD clock is often UTC.
    // Compare calendar days in the publisher's timezone, retaining the actual
    // timestamp only when every declaration supports that precision.
    const comparisonDay =
      host === "nsw.gov.au" && timestamp
        ? new Intl.DateTimeFormat("en-CA", {
            timeZone: "Australia/Sydney",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(timestamp))
        : day;
    return { timestamp, day: comparisonDay };
  });
  if (invalid || parsed.some((value) => !value))
    return { publisherPublishedAt: null, publisherDateStatus: "invalid" };
  const values = parsed.filter((value): value is NonNullable<typeof value> => !!value);
  const timestamps = [...new Set(values.map((value) => value.timestamp))];
  if (timestamps.length === 1 && timestamps[0] && !days.length)
    return { publisherPublishedAt: timestamps[0], publisherDateStatus: "available" };
  const declaredDays = [...days, ...values.map((value) => value.day)];
  const uniqueDays = [...new Set(declaredDays)];
  if (uniqueDays.length === 1 && uniqueDays[0]) {
    const day = uniqueDays[0];
    const calendar = new Date(`${day}T00:00:00Z`);
    if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== day)
      return { publisherPublishedAt: null, publisherDateStatus: "invalid" };
    return {
      publisherPublishedAt: null,
      publisherPublishedDay: day,
      publisherDateStatus: "available",
    };
  }
  if (values.length || days.length)
    return { publisherPublishedAt: null, publisherDateStatus: "conflicting" };
  return { ...missingPublicationDate };
}
