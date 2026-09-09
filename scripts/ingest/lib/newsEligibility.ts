import type { FetchedItem } from "./rss";
import { propertyNewsHold, recentNewsTimestamp } from "../../../shared/propertyNewsQuality";

/** Applied before clustering, URL resolution, article extraction or model enrichment. */
export function briefingNewsHold(item: FetchedItem, now = new Date()): string | null {
  if (!["AU", "PROPERTY"].includes(item.channel)) return null;
  if (!recentNewsTimestamp(item.isoDate, now)) return "missing-or-old-feed-date";
  return propertyNewsHold(item, now.toISOString().slice(0, 10));
}
