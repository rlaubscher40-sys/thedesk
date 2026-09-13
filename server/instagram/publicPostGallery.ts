import { z } from "zod";
import { env } from "../core/env";
import { cached } from "../core/cache";
import { recentSocialReceipts } from "../db/socialPublication";
import { readReelPublicationHistory } from "../db/reelHistory";
import { REEL_PUBLICATION_FAMILIES } from "./reelCandidates";
const REEL_READS: Record<string, { title: string; path: string }> = {
  "instagram-reel-abs-rents-brisbane-perth-v1": {
    title: "Brisbane vs Perth rents",
    path: "/markets/compare/brisbane-vs-perth",
  },
  "instagram-reel-abs-approvals-brisbane-perth-v1": {
    title: "Brisbane and Perth supply",
    path: "/markets/compare/brisbane-vs-perth#housing-approvals",
  },
  "instagram-reel-abs-rents-eight-capitals-v1": {
    title: "Eight capital-city rents",
    path: "/social#capital-rents",
  },
  "instagram-reel-abs-sydney-rent-change-v1": {
    title: "Sydney rent changes",
    path: "/markets/sydney#rental-conditions",
  },
  "instagram-reel-abs-sydney-before-buy-v1": {
    title: "Before you buy in Sydney",
    path: "/markets/sydney#housing-approvals",
  },
  "instagram-reel-nhsac-housing-balance-v1": {
    title: "Australia’s housing supply gap",
    path: "/markets/housing-balance",
  },
  "instagram-reel-rba-new-loan-rates-v1": {
    title: "New home-loan rates",
    path: "/social#new-loan-rates",
  },
  "instagram-reel-abs-interstate-qld-wa-v1": {
    title: "Queensland and WA migration",
    path: "/markets/compare/brisbane-vs-perth#state-population",
  },
};
const receipt = z.object({
  postId: z.string().regex(/^\d{1,64}$/),
  headline: z.string().max(512),
  storyIds: z.array(z.number().int().positive().safe()).min(1).max(4),
});
const mediaSchema = z.object({
  media_type: z.string().optional(),
  media_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  permalink: z.string().optional(),
  caption: z.string().optional(),
});
export function publicMediaFields(raw: unknown) {
  const data = mediaSchema.parse(raw);
  const safe = (value: string | undefined, image: boolean) => {
    try {
      const url = new URL(value ?? "");
      if (url.protocol !== "https:" || url.username || url.password) return null;
      const allowed = image
        ? /(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(url.hostname)
        : /(^|\.)instagram\.com$/.test(url.hostname);
      return allowed ? url.href : null;
    } catch {
      return null;
    }
  };
  return {
    thumbnail: safe(data.media_type === "VIDEO" ? data.thumbnail_url : data.media_url, true),
    permalink: safe(data.permalink, false),
    captionTitle: data.caption?.split(/\n/)[0]?.trim().slice(0, 220) ?? null,
  };
}
async function media(id: string) {
  if (!env.instagramAccessToken) return null;
  return cached(`public-social-cover:${id}`, 10 * 60_000, async () => {
    try {
      const url = new URL(`https://graph.facebook.com/v21.0/${id}`);
      url.searchParams.set("fields", "media_type,media_url,thumbnail_url,permalink,caption");
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${env.instagramAccessToken}` },
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return null;
      return publicMediaFields(await response.json());
    } catch {
      return null;
    }
  });
}
/** Confirmed public media only; never expose job diagnostics, credentials or draft assets. */
export async function publicPostGallery(now = new Date()) {
  const [carouselRead, reelRead] = await Promise.allSettled([
    recentSocialReceipts(now),
    readReelPublicationHistory(Object.keys(REEL_PUBLICATION_FAMILIES)),
  ]);
  if (carouselRead.status === "rejected" && reelRead.status === "rejected")
    throw new Error("Publication records unavailable");
  const carousels = (carouselRead.status === "fulfilled" ? carouselRead.value : []).flatMap(
    (row) => {
      try {
        const parsed = receipt.parse(JSON.parse(row.detail ?? ""));
        if (!row.finishedAt) return [];
        return [
          {
            id: parsed.postId,
            title: parsed.headline,
            publishedAt: row.finishedAt,
            format: "Carousel",
            reference: null as string | null,
            links: parsed.storyIds.map((id, index) => ({
              title: `Read story ${index + 1}`,
              path: `/story/${id}`,
            })),
          },
        ];
      } catch {
        return [];
      }
    }
  );
  const reels = (reelRead.status === "fulfilled" ? reelRead.value : []).flatMap((row) => {
    const read = REEL_READS[row.key];
    return read
      ? [
          {
            id: row.postId,
            title: read.title,
            publishedAt: row.publishedAt,
            format: "Reel",
            reference: row.date,
            links: [{ title: "Read the evidence", path: read.path }],
          },
        ]
      : [];
  });
  const posts = [...carousels, ...reels]
    .filter(
      (post) =>
        Number.isFinite(post.publishedAt.getTime()) &&
        post.publishedAt <= now &&
        now.getTime() - post.publishedAt.getTime() < 30 * 86400000
    )
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, 6);
  return Promise.all(
    posts.map(async (post) => {
      const preview = await media(post.id);
      return {
        ...post,
        thumbnail: preview?.thumbnail ?? null,
        permalink: preview?.permalink ?? null,
        title: preview?.captionTitle || post.title,
      };
    })
  );
}
