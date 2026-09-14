import { afterEach, expect, it, vi } from "vitest";
import { createMediaComment, fetchCommentExists, checkCommentAccess } from "./api";
afterEach(() => vi.unstubAllGlobals());
it("posts one form-encoded comment with a deadline and returns the exact ID", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "900" })));
  vi.stubGlobal("fetch", fetch);
  expect(
    await createMediaComment({
      mediaId: "100",
      accessToken: "test-token",
      message: "What changed?",
    })
  ).toBe("900");
  const [url, opts] = fetch.mock.calls[0]!;
  expect(url).toBe("https://graph.facebook.com/v21.0/100/comments");
  expect(opts.method).toBe("POST");
  expect(opts.signal).toBeInstanceOf(AbortSignal);
  expect(opts.body.get("message")).toBe("What changed?");
  expect(url).not.toContain("test-token");
});
it.each([400, 429, 500])("does not retry the non-idempotent call after HTTP %s", async (status) => {
  const fetch = vi.fn().mockResolvedValue(new Response('{"error":{"code":2}}', { status }));
  vi.stubGlobal("fetch", fetch);
  await expect(
    createMediaComment({ mediaId: "100", accessToken: "tok", message: "What changed?" })
  ).rejects.toThrow();
  expect(fetch).toHaveBeenCalledOnce();
});
it("rejects a missing success ID and prevents path injection", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetch);
  await expect(
    createMediaComment({ mediaId: "100", accessToken: "tok", message: "What changed?" })
  ).rejects.toThrow("uncertain");
  await expect(
    createMediaComment({ mediaId: "100/other", accessToken: "tok", message: "What changed?" })
  ).rejects.toThrow("Invalid");
  expect(fetch).toHaveBeenCalledOnce();
});
it("does not interpret an inaccessible saved comment as deleted", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response('{"error":{"code":100}}', { status: 400 }))
  );
  await expect(fetchCommentExists({ commentId: "900", accessToken: "tok" })).rejects.toThrow();
});
it("checks comment permissions with a bounded read, including an empty comment list", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{"data":[]}'));
  vi.stubGlobal("fetch", fetch);
  expect(await checkCommentAccess({ mediaId: "100", accessToken: "tok" })).toBe("ready");
  expect(fetch.mock.calls[0]![1]).not.toHaveProperty("method", "POST");
  expect(fetch.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);
});
it.each([
  [190, "access_denied"],
  [200, "access_denied"],
  [4, "rate_limited"],
  [100, "unavailable"],
])("classifies read-only access error %s", async (code, state) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code } }), { status: 400 }))
  );
  expect(await checkCommentAccess({ mediaId: "100", accessToken: "tok" })).toBe(state);
});
