import { and, sql } from "drizzle-orm";
import { dailyFeedItems } from "./schema";
import type { ArchiveFilters } from "../../shared/archiveScope";

/** Apply geography/date before every result cap, including browse and counts. */
export function archiveConditions(filters: ArchiveFilters = {}) {
  return and(
    sql`${dailyFeedItems.channel} <> 'HOLD'`,
    filters.region === "AU" ? sql`${dailyFeedItems.channel} IN ('AU', 'PROPERTY')` : undefined,
    filters.region === "INTERNATIONAL"
      ? sql`${dailyFeedItems.channel} NOT IN ('AU', 'PROPERTY')`
      : undefined,
    filters.since ? sql`${dailyFeedItems.feedDate} >= ${filters.since}` : undefined
  );
}
