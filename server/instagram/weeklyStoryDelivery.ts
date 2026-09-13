import { createStoryContainer, publishContainer, waitForContainerReady } from "./api";
import { publishCarouselStoryOnce } from "./carouselStoryReceipt";
import { storeTempImage, removeTempImage } from "./tempStore";
import { recordServerError } from "../db/health";

/** A bounded sequence after a confirmed feed publication. Stop on any uncertain
 * result; do not replay old editions or reset permanent Story reservations. */
export async function postWeeklyStoryFrames(opts: {
  frames: [Buffer, Buffer, Buffer];
  carouselId: string;
  sourceId: number;
  igUserId: string;
  accessToken: string;
  siteUrl: string;
}): Promise<void> {
  const names = ["weekly-cover", "weekly-detail", "weekly-roundup"] as const;
  for (const [index, bytes] of opts.frames.entries()) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 45000);
      timer.unref?.();
    });
    const uuid = storeTempImage(bytes);
    try {
      await publishCarouselStoryOnce(
        opts.carouselId,
        opts.sourceId,
        async () => {
          const containerId = await createStoryContainer({
            igUserId: opts.igUserId,
            accessToken: opts.accessToken,
            imageUrl: `${opts.siteUrl}/instagram/temp/${uuid}.jpg`,
          });
          await waitForContainerReady({
            containerId,
            accessToken: opts.accessToken,
            timeoutMs: 20000,
          });
          return publishContainer({
            igUserId: opts.igUserId,
            accessToken: opts.accessToken,
            creationId: containerId,
          });
        },
        names[index]!
      );
    } catch (error) {
      const message = `Weekly Story ${index + 1}/3 stopped: ${(error as Error).message}`;
      console.error(`[instagram] ${message}`);
      await recordServerError({
        level: "warn",
        message: message.slice(0, 512),
        route: "instagram/weekly-story",
      }).catch(() => {});
      return;
    } finally {
      removeTempImage(uuid);
    }
  }
}
