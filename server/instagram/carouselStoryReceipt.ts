import {
  readSocialRecords,
  reserveSocialRecords,
  confirmSocialRecords,
} from "../db/socialPublication";
import { createHash } from "node:crypto";

export const carouselStoryKey = (carouselId: string, storyId: number) =>
  "ig-story-" +
  createHash("sha256").update(`carousel-story:${carouselId}:${storyId}`).digest("hex").slice(0, 56);

/** A separate permanent claim for each actual Story. Never retry a Meta call
 * after uncertainty and never infer its result from another recent post. */
export async function publishCarouselStoryOnce(
  carouselId: string,
  sourceId: number,
  publish: () => Promise<string>
) {
  if (!/^\d{1,64}$/.test(carouselId) || !Number.isSafeInteger(sourceId) || sourceId < 1)
    throw new Error("Invalid carousel Story identity");
  const key = carouselStoryKey(carouselId, sourceId);
  if ((await readSocialRecords([key])).length)
    throw new Error("Carousel Story already reserved or confirmed; inspect its receipt");
  await reserveSocialRecords([key]);
  const storyId = await publish();
  if (!/^\d{1,64}$/.test(storyId))
    throw new Error("Story outcome uncertain; publication remains locked");
  const detail = JSON.stringify({ carouselId, sourceId, storyId });
  await confirmSocialRecords([key], detail);
  const [saved] = await readSocialRecords([key]);
  if (saved?.status !== "success" || saved.detail !== detail)
    throw new Error("Story receipt not confirmed; publication remains locked");
  console.log("[carousel-story] confirmed " + detail);
  return storyId;
}
