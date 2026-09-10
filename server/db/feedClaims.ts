import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { articleIdentity } from "../../scripts/ingest/lib/dedupe";
import { getDb } from "./client";
import { dailyFeedItems, type InsertDailyFeedItem } from "./schema";
import { isEnrichedChannel } from "../../shared/const";
import { feedEnrichmentJobs } from "./feedEnrichmentSchema";
import { feedIngestClaims } from "./collectionEfficiencySchema";
import { feedEvidenceFingerprints } from "./feedEvidenceSchema";
import { fingerprintStory } from "../../shared/storyEvidenceDuplicate";

export function feedClaimIdentity(
  item: Pick<InsertDailyFeedItem, "title" | "sourceUrl" | "feedDate" | "source" | "channel">
) {
  const identity = articleIdentity({ url: item.sourceUrl ?? "", title: item.title });
  // URL-less generic headlines are scoped to source/channel/day, not across days.
  const key = identity.startsWith("url:")
    ? identity
    : JSON.stringify([identity, item.source, item.channel ?? "AU", item.feedDate]);
  return createHash("sha256").update("feed-identity-v1\n").update(key).digest("hex");
}

/** The claim and feed insertion commit together. A losing worker receives no
 * item ID, so it cannot enter the downstream enrichment path. No network/model
 * work occurs under this lock. Failed inserts roll the claim back for retry.
 */
export type FeedIngestItem = InsertDailyFeedItem & { articleText?: string | null };
export async function insertFeedOnce(input: FeedIngestItem, now = new Date()): Promise<number> {
  const { articleText, ...item } = input;
  const db = getDb();
  if (!db) throw new Error("Feed database unavailable");
  const identity = feedClaimIdentity(item);
  return db.transaction(async (tx) => {
    await tx
      .insert(feedIngestClaims)
      .values({ identity })
      .onDuplicateKeyUpdate({ set: { identity: sql`${feedIngestClaims.identity}` } });
    const [claim] = await tx
      .select()
      .from(feedIngestClaims)
      .where(eq(feedIngestClaims.identity, identity))
      .for("update");
    if (!claim) throw new Error("Feed identity lock unavailable");
    if (claim.acceptedAt && now.getTime() - claim.acceptedAt.getTime() < 14 * 86_400_000) return 0;
    const result = await tx.insert(dailyFeedItems).values(item);
    const id = Number((result as unknown as Array<{ insertId?: number }>)[0]?.insertId ?? 0);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Feed insertion returned no item ID");
    await tx
      .update(feedIngestClaims)
      .set({ feedItemId: id, acceptedAt: now })
      .where(eq(feedIngestClaims.identity, identity));
    if (isEnrichedChannel(item.channel ?? "AU")) {
      const fingerprint = fingerprintStory({ ...input, channel: item.channel ?? "AU" });
      if (fingerprint)
        await tx.insert(feedEvidenceFingerprints).values({ feedItemId: id, fingerprint });
      await tx.insert(feedEnrichmentJobs).values({
        feedItemId: id,
        input: {
          title: item.title,
          summary: item.summary,
          category: item.category,
          articleText: articleText?.trim().slice(0, 6000) ?? null,
        },
      });
    }
    return id;
  });
}
