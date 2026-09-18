import { and, desc, eq, gte, like, sql } from "drizzle-orm";
import { getDb } from "./client";
import { isDemoMode } from "../demo/store";
import { instagramPosts, jobRuns } from "./schema";

/** All recent receipts, not just the latest reference period per recipe.
 * Unknown recipes and unlinked recorded Reels are held by the caller. */
export async function readDocumentaryComparisonHistory(now: Date) {
  const db = getDb();
  if (!db || isDemoMode()) throw new Error("Durable comparison history unavailable.");
  const since = new Date(now.getTime() - 90 * 86_400_000);
  const [receipts, posts] = await Promise.all([
    db
      .select({ key: jobRuns.jobKey, date: jobRuns.runDate, detail: jobRuns.detail })
      .from(jobRuns)
      .where(
        and(
          like(jobRuns.jobKey, "instagram-reel-%"),
          eq(jobRuns.status, "success"),
          sql`${jobRuns.detail} regexp '^Published media [0-9]+$'`,
          sql`coalesce(${jobRuns.finishedAt}, ${jobRuns.startedAt}) >= ${since}`
        )
      )
      .orderBy(desc(jobRuns.startedAt))
      .limit(201),
    db
      .select({ postId: instagramPosts.mediaId })
      .from(instagramPosts)
      .where(and(eq(instagramPosts.postType, "reel"), gte(instagramPosts.createdAt, since)))
      .orderBy(desc(instagramPosts.createdAt))
      .limit(201),
  ]);
  if (receipts.length > 200 || posts.length > 200)
    throw new Error("Comparison history exceeds audited limit.");
  const isDelivery = (key: string) =>
    key === "instagram-reel-delivery-programme-v1" ||
    /^instagram-reel-delivery-(?:speech2-)?\d{4}-\d{2}-01$/.test(key);
  const history = receipts
    .filter((r) => !isDelivery(r.key))
    .map((r) => ({
      key: r.key,
      date: r.date,
      postId: r.detail!.slice("Published media ".length),
    }));
  // Delivery watermarks repeat the publication's media ID; they are not a
  // second editorial identity. Only collapse known markers when their exact
  // media ID has a permanent publication receipt in this comparison window.
  if (
    receipts.some(
      (r) =>
        isDelivery(r.key) &&
        !history.some(
          (publication) => publication.postId === r.detail!.slice("Published media ".length)
        )
    )
  )
    throw new Error("A recent Reel delivery lacks a linked publication receipt.");
  if (posts.some((post) => !history.some((r) => r.postId === post.postId)))
    throw new Error("A recent recorded Reel lacks a linked publication receipt.");
  return history;
}
