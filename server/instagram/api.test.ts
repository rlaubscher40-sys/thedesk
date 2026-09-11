/**
 * Covers the retry behaviour on the Graph API reads that feed the admin panel.
 *
 * Context: Meta throws transient 500s at us regularly — one killed a morning
 * carousel, and another was sitting in the publishing-quota row of the admin
 * panel minutes later, printing raw Graph JSON where a number belonged. The
 * posting path rides those out over ~80 seconds; a UI read cannot, because it
 * refetches every 60 seconds and a long backoff would just queue requests up.
 * So the quota read gets a short, bounded ladder, and this pins that down:
 * it must retry at all, and it must not retry forever.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMediaMetrics, fetchMediaMetricsResult, fetchPublishingLimit } from "./api";

const QUOTA_BODY = {
  data: [{ quota_usage: 3, config: { quota_total: 50, quota_duration: 86400 } }],
};

/** A Meta-side transient fault, exactly as the Graph API sends it. */
const TRANSIENT_500 = JSON.stringify({
  error: {
    message: "An unknown error has occurred.",
    type: "OAuthException",
    code: 1,
    fbtrace_id: "A4PSbQCJDWJPF",
  },
});

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
}

function errorResponse(status: number, body: string) {
  return { ok: false, status, json: async () => JSON.parse(body), text: async () => body };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchMediaMetrics", () => {
  it("classifies an inaccessible media ID without claiming deletion or making a second read", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        errorResponse(400, JSON.stringify({ error: { code: 100, error_subcode: 33 } }))
      );
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchMediaMetricsResult({ mediaId: "123", accessToken: "tok" });
    expect(result).toMatchObject({ status: "unavailable", reason: "media_unavailable" });
    expect(Object.values(result.metrics).every((value) => value === null)).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    [190, "unavailable", "access_denied"],
    [4, "failed", "rate_limited"],
  ])("stops reads on account-wide error %s", async (code, status, reason) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(errorResponse(400, JSON.stringify({ error: { code } })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchMediaMetricsResult({ mediaId: "123", accessToken: "tok" })).toMatchObject({
      status,
      reason,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("keeps good node counts when only insights are denied", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(okResponse({ like_count: 0, comments_count: 2 }))
        .mockResolvedValueOnce(errorResponse(400, JSON.stringify({ error: { code: 10 } })))
    );
    expect(await fetchMediaMetricsResult({ mediaId: "123", accessToken: "tok" })).toMatchObject({
      status: "partial",
      reason: "access_denied",
      metrics: { likes: 0, comments: 2, saved: null },
    });
  });
  it("keeps missing and malformed counts unknown, accepts zero, and bounds both reads", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse({ like_count: 0, comments_count: -1 }))
      .mockResolvedValueOnce(
        okResponse({
          data: [
            { name: "reach", values: [{ value: 100 }] },
            { name: "saved", values: [{ value: "3" }] },
            { name: "shares", values: [{ value: 0 }] },
            { name: "total_interactions", values: [{ value: 1.5 }] },
          ],
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchMediaMetrics({ mediaId: "123", accessToken: "tok" })).toEqual({
      likes: 0,
      comments: null,
      reach: 100,
      saved: null,
      shares: 0,
      totalInteractions: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) expect(call[1].signal).toBeInstanceOf(AbortSignal);
  });

  it("returns unknown counts on provider failures instead of fabricated zeroes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(500, TRANSIENT_500));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchMediaMetrics({ mediaId: "123", accessToken: "tok" })).toEqual({
      likes: null,
      comments: null,
      reach: null,
      saved: null,
      shares: null,
      totalInteractions: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("fetchPublishingLimit", () => {
  it("uses the documented quota edge and accepts zero usage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse({
        data: [{ quota_usage: 0, config: { quota_total: 100, quota_duration: 86400 } }],
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchPublishingLimit({ igUserId: "123", accessToken: "tok" })).toEqual({
      usage: 0,
      quota: 100,
      windowHours: 24,
    });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/v21.0/123/content_publishing_limit");
    expect(url.searchParams.get("fields")).toBe("quota_usage,config");
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    { data: [{ quota_usage: -1, config: { quota_total: -1, quota_duration: -1 } }] },
    { data: [{ quota_usage: "0", config: { quota_total: "100", quota_duration: "86400" } }] },
    { data: [{ quota_usage: 1.5, config: { quota_total: 0, quota_duration: 0 } }] },
    { data: {} },
    { data: [{ quota_usage: 0 }, { quota_usage: 1 }] },
    { content_publishing_limit: QUOTA_BODY },
  ])("rejects malformed or ambiguous quota: %j", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(body)));
    expect(await fetchPublishingLimit({ igUserId: "123", accessToken: "tok" })).toEqual({
      usage: null,
      quota: null,
      windowHours: null,
    });
  });

  it("rides out a single transient 500 and returns the quota", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(500, TRANSIENT_500))
      .mockResolvedValueOnce(okResponse(QUOTA_BODY));
    vi.stubGlobal("fetch", fetchMock);

    const limit = await fetchPublishingLimit({ igUserId: "123", accessToken: "tok" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(limit).toEqual({ usage: 3, quota: 50, windowHours: 24 });
  });

  it("gives up after the second attempt rather than hammering a UI query", async () => {
    // The ladder is deliberately short here. If this ever needs more attempts,
    // the 60s refetch interval on the admin query needs rethinking first.
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(500, TRANSIENT_500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublishingLimit({ igUserId: "123", accessToken: "tok" })).rejects.toThrow(
      /Instagram API 500/
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a rate-limit block", async () => {
    // A block doesn't clear in seconds and repeating the call reinforces it, so
    // this must fail on the first response even though it's a read.
    const body = JSON.stringify({
      error: { message: "Application request limit reached", code: 4 },
    });
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(403, body));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublishingLimit({ igUserId: "123", accessToken: "tok" })).rejects.toThrow(
      /Application request limit reached/
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports nulls, not a throw, when the account exposes no quota block", async () => {
    // Keeps the panel rendering when the field simply isn't there.
    const fetchMock = vi.fn().mockResolvedValue(okResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    const limit = await fetchPublishingLimit({ igUserId: "123", accessToken: "tok" });
    expect(limit).toEqual({ usage: null, quota: null, windowHours: null });
  });
});
