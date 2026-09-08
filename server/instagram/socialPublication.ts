import { createHash } from "node:crypto";
import type { DailyFeedItem } from "../db/schema";
import {
  readSocialRecords,
  reserveSocialRecords,
  confirmSocialRecords,
} from "../db/socialPublication";
import { storyPublicationKeys } from "./socialProvenance";

export function socialSlotKey(scope: string) {
  return "ig-slot-" + createHash("sha256").update(scope).digest("hex").slice(0, 56);
}
export async function recoverSocialPublication(scope: string) {
  const [row] = await readSocialRecords([socialSlotKey(scope)]);
  if (!row) return null;
  if (row.status === "success") {
    try {
      const value = JSON.parse(row.detail ?? "");
      if (
        typeof value.postId === "string" &&
        /^\d+$/.test(value.postId) &&
        typeof value.headline === "string" &&
        ["navy", "light"].includes(value.coverVariant)
      )
        return value as { postId: string; headline: string; coverVariant: "navy" | "light" };
    } catch {
      /* an unreadable receipt is uncertainty, not permission to retry */
    }
  }
  throw new Error(
    "This carousel publication is reserved or uncertain; automatic retries are blocked."
  );
}
export async function unpublishedSocialStories(stories: DailyFeedItem[]) {
  const all = stories.flatMap(storyPublicationKeys);
  const records = await readSocialRecords(all);
  const used = new Set(records.map((row) => row.jobKey));
  return stories.filter((story) => {
    const keys = storyPublicationKeys(story);
    if (!keys.length || keys.some((key) => used.has(key))) return false;
    keys.forEach((key) => used.add(key));
    return true;
  });
}
export async function publishSocialOnce(
  scope: string,
  stories: DailyFeedItem[],
  headline: string,
  publish: () => Promise<string>,
  coverVariant: "navy" | "light" = "navy"
) {
  const keys = [socialSlotKey(scope), ...stories.flatMap(storyPublicationKeys)];
  if (!stories.length || stories.some((story) => storyPublicationKeys(story).length !== 2))
    throw new Error("Source identity missing; cannot reserve social publication");
  await reserveSocialRecords(keys);
  // Never release a reservation after entering Meta's non-idempotent call.
  const postId = await publish();
  if (!/^\d+$/.test(postId))
    throw new Error("Instagram returned no valid media ID; publication remains locked");
  await confirmSocialRecords(keys, JSON.stringify({ postId, headline, coverVariant }));
  return postId;
}
