/**
 * Instagram Graph API client.
 *
 * Two-step posting flow:
 *   1. createImageContainer  — registers the image URL; returns a creation_id
 *   2. publishContainer      — makes it live on the profile
 *
 * For carousels, create one child container per slide (is_carousel_item=true),
 * then bundle them into a CAROUSEL container, then publish.
 *
 * Docs: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
 */

const BASE = "https://graph.facebook.com/v21.0";

/**
 * True when an Instagram error is a rate-limit or integrity ("Action is
 * blocked") response rather than a transient network/processing hiccup. These
 * are NOT worth retrying — hammering a block just deepens it — so callers
 * surface them immediately and let the account cool down. Covers the app/user
 * request-limit codes (4, 17, 32, 613) and the spam-integrity subcode
 * (2207051), matched by code and by message so a wording change can't slip past.
 */
export function isRateLimitError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("application request limit reached") ||
    msg.includes("action is blocked") ||
    msg.includes("rate limit") ||
    msg.includes("2207051") ||
    /"(error_subcode|code)":\s*(4|17|32|613|2207051)\b/.test(msg) ||
    msg.includes(" 429 ")
  );
}

async function igPost<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const body = new URLSearchParams(params);
  const res = await fetch(`${BASE}${endpoint}`, {
    method: "POST",
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Instagram API ${res.status} at ${endpoint}: ${detail.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Retry a transient Instagram call a few times with linear backoff. Use only
 * for idempotent operations — container creation is safe to retry because a
 * repeated attempt just registers a fresh throwaway container. Never wrap
 * publishContainer, which is not idempotent and would risk a double-post.
 *
 * A rate-limit / integrity block is never retried: those don't clear in
 * seconds, and repeating the call only reinforces the block, so we throw on the
 * first one and let the account breathe.
 */
async function withIgRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (isRateLimitError(err)) {
        console.warn(`[instagram] ${label} hit a rate-limit/integrity block, not retrying.`);
        throw err;
      }
      if (attempt === attempts) break;
      const delayMs = 3000 * attempt;
      console.warn(
        `[instagram] ${label} attempt ${attempt}/${attempts} failed, retrying in ${delayMs}ms:`,
        (err as Error).message
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}

/** Create a single-image container. For carousel children set isCarouselItem=true. */
export async function createImageContainer(opts: {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption?: string;
  altText?: string;
  isCarouselItem?: boolean;
}): Promise<string> {
  const params: Record<string, string> = {
    image_url: opts.imageUrl,
    access_token: opts.accessToken,
  };
  if (opts.isCarouselItem) params.is_carousel_item = "true";
  if (opts.caption) params.caption = opts.caption;
  if (opts.altText) params.alt_text = opts.altText;

  const data = await withIgRetry("createImageContainer", () =>
    igPost<{ id: string }>(`/${opts.igUserId}/media`, params)
  );
  return data.id;
}

/**
 * Create a STORIES container from a single image. Stories are a single 9:16
 * media item (no carousels), live for 24 hours. Publish with publishContainer.
 *
 * Note: STORIES containers do NOT accept `alt_text` (it's only valid for
 * IMAGE and carousel-item media). Sending it makes the API reject the whole
 * container, which is what silently killed the daily/weekly Story posts.
 */
export async function createStoryContainer(opts: {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
}): Promise<string> {
  const data = await igPost<{ id: string }>(`/${opts.igUserId}/media`, {
    media_type: "STORIES",
    image_url: opts.imageUrl,
    access_token: opts.accessToken,
  });
  return data.id;
}

/**
 * Poll a media container until it's ready to publish. Instagram processes the
 * uploaded image asynchronously; publishing before the container reports
 * FINISHED returns "Media ID is not available". Image containers are usually
 * ready almost immediately, but STORIES media can lag a beat, so we poll.
 *
 * Resolves on FINISHED, throws on ERROR/EXPIRED or once the timeout elapses.
 */
export async function waitForContainerReady(opts: {
  containerId: string;
  accessToken: string;
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 30000;
  const intervalMs = opts.intervalMs ?? 3000;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const data = await igGet<{ status_code?: string }>(`/${opts.containerId}`, {
      fields: "status_code",
      access_token: opts.accessToken,
    });
    const status = data.status_code;
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`container ${opts.containerId} reported status ${status}`);
    }
    if (Date.now() > deadline) {
      throw new Error(
        `container ${opts.containerId} not ready after ${timeoutMs}ms (last status: ${status ?? "unknown"})`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/** Bundle child container IDs into a CAROUSEL container. */
export async function createCarouselContainer(opts: {
  igUserId: string;
  accessToken: string;
  childrenIds: string[];
  caption: string;
}): Promise<string> {
  const data = await igPost<{ id: string }>(
    `/${opts.igUserId}/media`,
    {
      media_type: "CAROUSEL",
      children: opts.childrenIds.join(","),
      caption: opts.caption,
      access_token: opts.accessToken,
    }
  );
  return data.id;
}

export type MediaMetrics = {
  likes: number | null;
  comments: number | null;
  reach: number | null;
  saved: number | null;
  shares: number | null;
  totalInteractions: number | null;
};

async function igGet<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${BASE}${endpoint}?${qs}`);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Instagram API ${res.status} at ${endpoint}: ${detail.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Fetch engagement metrics for a published media id. Resilient by design:
 * like/comment counts come from reliable node fields, while the insights
 * metrics (reach/saved/shares/total_interactions) are fetched separately and
 * tolerated if the account or API version does not expose them. Any field we
 * cannot read comes back null.
 */
export async function fetchMediaMetrics(opts: {
  mediaId: string;
  accessToken: string;
}): Promise<MediaMetrics> {
  const metrics: MediaMetrics = {
    likes: null,
    comments: null,
    reach: null,
    saved: null,
    shares: null,
    totalInteractions: null,
  };

  // 1. Reliable node fields.
  try {
    const fields = await igGet<{ like_count?: number; comments_count?: number }>(
      `/${opts.mediaId}`,
      { fields: "like_count,comments_count", access_token: opts.accessToken }
    );
    metrics.likes = fields.like_count ?? null;
    metrics.comments = fields.comments_count ?? null;
  } catch (err) {
    console.warn(`[instagram] media fields failed for ${opts.mediaId}:`, (err as Error).message);
  }

  // 2. Insights (best-effort; metric availability varies by API version).
  try {
    const insights = await igGet<{
      data?: Array<{ name: string; values?: Array<{ value: number }> }>;
    }>(`/${opts.mediaId}/insights`, {
      metric: "reach,saved,shares,total_interactions",
      access_token: opts.accessToken,
    });
    for (const row of insights.data ?? []) {
      const value = row.values?.[0]?.value ?? null;
      if (row.name === "reach") metrics.reach = value;
      else if (row.name === "saved") metrics.saved = value;
      else if (row.name === "shares") metrics.shares = value;
      else if (row.name === "total_interactions") metrics.totalInteractions = value;
    }
  } catch (err) {
    console.warn(`[instagram] insights failed for ${opts.mediaId}:`, (err as Error).message);
  }

  return metrics;
}

/** Publish a ready container (single image or carousel). */
export async function publishContainer(opts: {
  igUserId: string;
  accessToken: string;
  creationId: string;
}): Promise<string> {
  const data = await igPost<{ id: string }>(
    `/${opts.igUserId}/media_publish`,
    {
      creation_id: opts.creationId,
      access_token: opts.accessToken,
    }
  );
  return data.id;
}
