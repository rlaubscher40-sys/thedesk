import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { LAUNCH_POST_IDS, type LaunchPostId } from "../../shared/instagramLaunch";
import { env } from "../core/env";
import { siteUrl } from "../core/siteUrl";
import { getDb } from "../db/client";
import { jobRuns } from "../db/schema";
import { claimJobRun, markJobRun } from "../db/jobRuns";
import { recordInstagramPost } from "../db/instagramPosts";
import { getMarketDirectory } from "../markets/discovery";
import { renderLaunchSlide } from "../og/instagramCards";
import { renderDeskTakeCard } from "../og/takeCard";
import {
  createCarouselContainer,
  createImageContainer,
  fetchPublishingLimit,
  publishContainer,
  waitForContainerReady,
} from "./api";
import { buildLaunchContent, launchContentHash, type LaunchContent } from "./launchContent";
import { removeTempImage, storeTempImage } from "./tempStore";

// This is a one-time campaign, not a daily schedule. A constant logical date
// keeps its atomic job_runs reservation across days, restarts and deployments.
export const LAUNCH_DATE = "2026-09-08";
const launchJobKey = (id: LaunchPostId) => `instagram-launch-v1-${id}`;

async function contentFor(id: LaunchPostId): Promise<LaunchContent> {
  try {
    return buildLaunchContent(id, id === "comparison" ? await getMarketDirectory() : undefined);
  } catch {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Current, matching ABS evidence is unavailable. Try the comparison preview again later.",
    });
  }
}

async function renderContent(content: LaunchContent): Promise<Buffer[]> {
  if (content.comparison)
    return [
      await sharp(await renderDeskTakeCard(content.comparison))
        .jpeg({ quality: 92 })
        .toBuffer(),
    ];
  const images: Buffer[] = [];
  for (const [index, slide] of content.slides.entries()) {
    images.push(await renderLaunchSlide(slide, content.title, index + 1, content.slides.length));
  }
  return images;
}

export async function previewLaunchPost(id: LaunchPostId) {
  const content = await contentFor(id);
  const images = await renderContent(content);
  return {
    id,
    title: content.title,
    caption: content.caption,
    contentHash: launchContentHash(content),
    images: images.map((buffer) => `data:image/jpeg;base64,${buffer.toString("base64")}`),
  };
}

export async function launchPostStatus() {
  const db = getDb();
  if (!db) return { available: false, posts: [] };
  try {
    const posts = await db
      .select({ jobKey: jobRuns.jobKey, status: jobRuns.status, detail: jobRuns.detail })
      .from(jobRuns)
      .where(
        and(
          eq(jobRuns.runDate, LAUNCH_DATE),
          inArray(jobRuns.jobKey, LAUNCH_POST_IDS.map(launchJobKey))
        )
      );
    return { available: true, posts };
  } catch {
    return { available: false, posts: [] };
  }
}

export async function publishLaunchPost(id: LaunchPostId, reviewedHash: string) {
  const { instagramAccessToken: accessToken, instagramBusinessAccountId: igUserId } = env;
  if (!accessToken || !igUserId)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Instagram publishing is not configured.",
    });
  const content = await contentFor(id);
  if (launchContentHash(content) !== reviewedHash)
    throw new TRPCError({
      code: "CONFLICT",
      message: "The evidence or copy changed. Refresh and review the preview before publishing.",
    });
  const status = await launchPostStatus();
  if (!status.available || status.posts.some((post) => post.jobKey === launchJobKey(id))) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Publication is locked or its durable record is unavailable. Check the existing result before trying again.",
    });
  }
  const limit = await fetchPublishingLimit({ accessToken, igUserId });
  if (limit.usage == null || limit.quota == null || limit.usage >= limit.quota) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Publishing quota is unavailable or exhausted. No post was sent.",
    });
  }
  const images = await renderContent(content);
  const uuids: string[] = [];
  try {
    const childrenIds: string[] = [];
    for (const [index, image] of images.entries()) {
      const uuid = storeTempImage(image);
      uuids.push(uuid);
      const containerId = await createImageContainer({
        accessToken,
        igUserId,
        imageUrl: `${siteUrl()}/instagram/temp/${uuid}.jpg`,
        isCarouselItem: images.length > 1,
        caption: images.length === 1 ? content.caption : undefined,
        altText: content.slides[index]
          ? `${content.slides[index]!.title} ${content.slides[index]!.body}`
          : `${content.comparison!.take} ${content.comparison!.storyTitle}`,
      });
      await waitForContainerReady({ containerId, accessToken, timeoutMs: 60_000 });
      childrenIds.push(containerId);
    }
    const creationId =
      childrenIds.length === 1
        ? childrenIds[0]!
        : await createCarouselContainer({
            accessToken,
            igUserId,
            childrenIds,
            caption: content.caption,
          });
    if (childrenIds.length > 1)
      await waitForContainerReady({ containerId: creationId, accessToken, timeoutMs: 60_000 });

    // Reserve immediately before the non-idempotent operation. Pre-publication
    // rendering/container failures are safe to retry. Once reserved, never
    // auto-retry or infer success from a different recent scheduled post.
    if (!(await claimJobRun(launchJobKey(id), LAUNCH_DATE, 1))) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "This launch post is already reserved, or the reservation could not be saved. Nothing was published by this request.",
      });
    }
    let postId: string;
    try {
      postId = await publishContainer({ accessToken, igUserId, creationId });
    } catch {
      await markJobRun(
        launchJobKey(id),
        LAUNCH_DATE,
        "failed",
        `Outcome unknown; inspect Meta container ${creationId} and the profile before any manual recovery.`
      );
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Meta did not confirm publication. This slot is locked to prevent duplicates; inspect the profile before recovery.",
      });
    }
    await markJobRun(launchJobKey(id), LAUNCH_DATE, "success", `Published media ${postId}`);
    await recordInstagramPost({
      mediaId: postId,
      postType: "launch",
      headline: content.title,
      coverVariant: "navy",
    });
    return { postId, title: content.title };
  } finally {
    uuids.forEach(removeTempImage);
  }
}
