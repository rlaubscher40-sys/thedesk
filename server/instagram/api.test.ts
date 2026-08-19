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
import { fetchPublishingLimit } from "./api";

const QUOTA_BODY = {
  content_publishing_limit: {
    data: [{ quota_usage: 3, config: { quota_total: 50, quota_duration: 86400 } }],
  },
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

describe("fetchPublishingLimit", () => {
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
