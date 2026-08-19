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

/**
 * True when an Instagram error is one of Meta's OWN transient server faults —
 * the generic "An unexpected error has occurred. Please retry your request
 * later." that comes back as an HTTP 5xx (or error code 1/2) on a request that
 * is otherwise perfectly valid — or a plain network hiccup reaching the API.
 *
 * These are the opposite case to isRateLimitError: they clear on their own,
 * usually within a minute, so they're worth waiting out patiently rather than
 * failing the run. A 500 on container creation is what killed a whole morning
 * carousel, so the backoff for these is deliberately longer than for an
 * ordinary one-off failure.
 *
 * The strongest signal is Meta's own `"is_transient": true` flag, which it sets
 * on exactly these faults — the observed payload was:
 *   {"error":{"message":"An unexpected error has occurred. Please retry your
 *    request later.","type":"OAuthException","is_transient":true,"code":2}}
 * The rest are fallbacks for the same condition arriving without that flag (a
 * bare 5xx, a network-level failure before any body came back).
 */
export function isTransientServerError(err: unknown): boolean {
  if (isRateLimitError(err)) return false;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    // Meta says so itself. Matched loosely because the flag reaches us inside a
    // JSON string that may have been escaped (\"is_transient\":true) on the way.
    /is_transient\\?"?\s*:\s*true/i.test(msg) ||
    /instagram api 5\d\d\b/i.test(msg) ||
    lower.includes("an unexpected error has occurred") ||
    lower.includes("please retry your request later") ||
    // Meta's generic transient codes: 1 = unknown, 2 = service unavailable.
    /"code":\s*[12]\b/.test(msg) ||
    lower.includes("fetch failed") ||
    lower.includes("econnreset") ||
    lower.includes("etimedout") ||
    lower.includes("socket hang up")
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
 * Attempts every container-creation call gets. Five with the transient backoff
 * below spans about 80 seconds, which comfortably outlasts the Meta-side 500s
 * we actually see (they clear in seconds to a minute) while still leaving the
 * whole post well inside the scheduled job's budget.
 */
const IG_RETRY_ATTEMPTS = 5;

/**
 * Retry a transient Instagram call with linear backoff. Use only for
 * idempotent operations — creating ANY container (image, carousel parent, or
 * story) is safe to retry because a repeated attempt just registers a fresh
 * throwaway container, and an unpublished one expires on its own. Never wrap
 * publishContainer, which is not idempotent and would risk a double-post.
 *
 * A rate-limit / integrity block is never retried: those don't clear in
 * seconds, and repeating the call only reinforces the block, so we throw on the
 * first one and let the account breathe.
 *
 * Meta's own transient faults (5xx / "please retry your request later") get a
 * markedly longer backoff than an ordinary hiccup. The old 3 × 3s ladder gave
 * up after ~9 seconds, which is how a single Graph API 500 on container
 * creation took out an entire morning carousel.
 */
async function withIgRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = IG_RETRY_ATTEMPTS
): Promise<T> {
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
      const step = isTransientServerError(err) ? 8000 : 3000;
      const delayMs = step * attempt;
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
  const data = await withIgRetry("createStoryContainer", () =>
    igPost<{ id: string }>(`/${opts.igUserId}/media`, {
      media_type: "STORIES",
      image_url: opts.imageUrl,
      access_token: opts.accessToken,
    })
  );
  return data.id;
}

/**
 * Poll a media container until it's ready to publish. Instagram processes the
 * uploaded image asynchronously; publishing before the container reports
 * FINISHED returns "Media ID is not available". Image containers are usually
 * ready almost immediately, but STORIES media can lag a beat, so we poll.
 *
 * Resolves on FINISHED, throws on ERROR/EXPIRED or once the timeout elapses.
 *
 * A transient fault on the STATUS READ is not a failure of the container — the
 * container is fine, we just couldn't ask about it — so those are swallowed and
 * the poll carries on until the deadline. Losing a whole post to one flaky read
 * seconds before publish is the exact fragility this whole file guards against.
 * Anything else (a bad token, a malformed id) still throws immediately.
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
  let lastStatus = "unknown";

  for (;;) {
    // Read the status. Only the READ is guarded — the container's own verdict
    // below is evaluated outside the catch, so an ERROR/EXPIRED container can
    // never be mistaken for a flaky read and polled on regardless.
    let status: string | undefined;
    try {
      const data = await igGet<{ status_code?: string }>(`/${opts.containerId}`, {
        fields: "status_code",
        access_token: opts.accessToken,
      });
      status = data.status_code;
      lastStatus = status ?? "unknown";
    } catch (err) {
      if (!isTransientServerError(err)) throw err;
      lastStatus = `read failed (${(err as Error).message.slice(0, 120)})`;
      console.warn(
        `[instagram] status read for container ${opts.containerId} failed transiently, still polling:`,
        (err as Error).message
      );
    }
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`container ${opts.containerId} reported status ${status}`);
    }
    if (Date.now() > deadline) {
      throw new Error(
        `container ${opts.containerId} not ready after ${timeoutMs}ms (last status: ${lastStatus})`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/**
 * Bundle child container IDs into a CAROUSEL container.
 *
 * Retried like the child containers. This was the one unprotected write left in
 * the carousel path, so a Meta-side 500 here aborted the whole post even though
 * every child image had already been accepted. Re-bundling the same children is
 * harmless: the abandoned parent is never published and expires on its own.
 */
export async function createCarouselContainer(opts: {
  igUserId: string;
  accessToken: string;
  childrenIds: string[];
  caption: string;
}): Promise<string> {
  const data = await withIgRetry("createCarouselContainer", () =>
    igPost<{ id: string }>(
      `/${opts.igUserId}/media`,
      {
        media_type: "CAROUSEL",
        children: opts.childrenIds.join(","),
        caption: opts.caption,
        access_token: opts.accessToken,
      }
    )
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

export type PublishingLimit = {
  /** Posts published via the API in the current rolling window. */
  usage: number | null;
  /** The account's cap for that window (Instagram's documented default is 50). */
  quota: number | null;
  /** Length of the rolling window in hours (the default is 24). */
  windowHours: number | null;
};

/**
 * Read the account's content-publishing quota usage straight from the Graph
 * API. This is the *documented* 50-posts-per-24h limit — NOT the opaque
 * "Action is blocked" integrity throttle that actually stalls our Stories — but
 * it's the one number Instagram will give us, so the admin can see at a glance
 * how much of the daily allowance a run consumed. Best-effort: any miss returns
 * nulls rather than throwing, so a quota check never breaks the admin panel.
 */
export async function fetchPublishingLimit(opts: {
  igUserId: string;
  accessToken: string;
}): Promise<PublishingLimit> {
  const data = await igGet<{
    content_publishing_limit?: {
      data?: Array<{
        quota_usage?: number;
        config?: { quota_total?: number; quota_duration?: number };
      }>;
    };
  }>(`/${opts.igUserId}`, {
    fields: "content_publishing_limit{quota_usage,config}",
    access_token: opts.accessToken,
  });
  const row = data.content_publishing_limit?.data?.[0];
  const duration = row?.config?.quota_duration;
  return {
    usage: row?.quota_usage ?? null,
    quota: row?.config?.quota_total ?? null,
    windowHours: typeof duration === "number" ? Math.round(duration / 3600) : null,
  };
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

/**
 * Return the account's newest published media id if it landed within `withinMs`,
 * else null. Used to recover from Instagram's habit of returning a rate-limit
 * 403 on `media_publish` even though it actually published the post: if a fresh
 * post is sitting at the top of the feed, the publish really did succeed and we
 * can record it instead of logging a false failure. Best-effort — any read miss
 * returns null. The account only ever posts via this app, and our publishes are
 * hours apart, so a post this recent is unambiguously the one we just made.
 */
export async function findRecentMedia(opts: {
  igUserId: string;
  accessToken: string;
  withinMs: number;
}): Promise<string | null> {
  const data = await igGet<{ data?: Array<{ id: string; timestamp?: string }> }>(
    `/${opts.igUserId}/media`,
    { fields: "id,timestamp", limit: "1", access_token: opts.accessToken }
  );
  const newest = data.data?.[0];
  if (!newest?.timestamp) return null;
  const ts = Date.parse(newest.timestamp);
  if (Number.isFinite(ts) && Date.now() - ts <= opts.withinMs) return newest.id;
  return null;
}
