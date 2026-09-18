import { cleanReportingExcerpt } from "../../shared/reportingExcerpt";
import { extractSnippet } from "../db/searchRank";

/** Read-only projection: retain the archived record and strip known publisher promotions. */
export function publicFeedItem<T extends { summary?: string | null; snippet?: string | null }>(
  item: T,
  query?: string
): T {
  const summary =
    typeof item.summary === "string" ? cleanReportingExcerpt(item.summary) : item.summary;
  return {
    ...item,
    ...(typeof item.summary === "string" ? { summary } : {}),
    ...(query !== undefined
      ? { snippet: summary ? extractSnippet(query, summary) : null }
      : typeof item.snippet === "string"
        ? { snippet: cleanReportingExcerpt(item.snippet) }
        : {}),
  };
}
