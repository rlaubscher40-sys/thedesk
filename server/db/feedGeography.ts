import { editorialCategory } from "../../shared/editorialCategory";
import { and, asc, gt, inArray } from "drizzle-orm";
import { isClearlyOverseas, storyChannel } from "../../shared/storyGeography";
import { dailyFeedItems } from "./schema";
import { getDb } from "./client";

/** Idempotent boot repair for stories imported under the old feed mappings.
 * Keep IDs, links, dates, saved stories and editorial text. Only move lanes.
 * Seek pagination stays correct while rows leave the selected channels. */
export async function repairFeedGeography(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  let cursor = 0;
  let changed = 0;
  for (;;) {
    const rows = await db
      .select({
        id: dailyFeedItems.id,
        title: dailyFeedItems.title,
        source: dailyFeedItems.source,
        category: dailyFeedItems.category,
        channel: dailyFeedItems.channel,
      })
      .from(dailyFeedItems)
      .where(
        and(gt(dailyFeedItems.id, cursor), inArray(dailyFeedItems.channel, ["AU", "PROPERTY"]))
      )
      .orderBy(asc(dailyFeedItems.id))
      .limit(250);
    if (!rows.length) return changed;
    const moves = new Map<string, number[]>();
    for (const row of rows.filter(isClearlyOverseas)) {
      const channel = storyChannel(row);
      moves.set(channel, [...(moves.get(channel) ?? []), row.id]);
    }
    for (const [channel, ids] of moves) {
      await db
        .update(dailyFeedItems)
        .set({ channel })
        .where(
          and(inArray(dailyFeedItems.id, ids), inArray(dailyFeedItems.channel, ["AU", "PROPERTY"]))
        );
      changed += ids.length;
    }
    cursor = rows[rows.length - 1]!.id;
  }
}

/** Narrow, idempotent correction for broad RSS feeds that tagged sports results as geopolitics. */
export async function repairEditorialCategories(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  let cursor = 0,
    changed = 0;
  for (;;) {
    const rows = await db
      .select({
        id: dailyFeedItems.id,
        title: dailyFeedItems.title,
        summary: dailyFeedItems.summary,
        category: dailyFeedItems.category,
      })
      .from(dailyFeedItems)
      .where(
        and(
          gt(dailyFeedItems.id, cursor),
          inArray(dailyFeedItems.category, ["GEOPOLITICS", "PROPERTY"])
        )
      )
      .orderBy(asc(dailyFeedItems.id))
      .limit(250);
    if (!rows.length) return changed;
    const ids = rows
      .filter((row) => editorialCategory(row.title, row.summary ?? "", row.category) === "OTHER")
      .map((row) => row.id);
    if (ids.length) {
      await db
        .update(dailyFeedItems)
        .set({ category: "OTHER" })
        .where(
          and(
            inArray(dailyFeedItems.id, ids),
            inArray(dailyFeedItems.category, ["GEOPOLITICS", "PROPERTY"])
          )
        );
      changed += ids.length;
    }
    cursor = rows[rows.length - 1]!.id;
  }
}
