import { afterEach, expect, it, vi } from "vitest";
import { createVideoStoryContainer, fetchStoryReach } from "./api";
afterEach(() => vi.unstubAllGlobals());
it("creates a video Story without unsupported caption, alt text or fake link parameters", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "123" })));
  vi.stubGlobal("fetch", fetch);
  expect(
    await createVideoStoryContainer({
      igUserId: "111",
      accessToken: "test",
      videoUrl: "https://thedesk.au/story.mp4",
    })
  ).toBe("123");
  expect(Object.fromEntries(fetch.mock.calls[0]![1].body.entries())).toEqual({
    media_type: "STORIES",
    video_url: "https://thedesk.au/story.mp4",
    access_token: "test",
  });
});
it("requests only Story reach and preserves a missing measurement", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ name: "reach", values: [{ value: 0 }] }] }))
    )
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })));
  vi.stubGlobal("fetch", fetch);
  const opts = { mediaId: "333", accessToken: "test" };
  expect(await fetchStoryReach(opts)).toBe(0);
  expect(new URL(fetch.mock.calls[0]![0]).searchParams.get("metric")).toBe("reach");
  expect(await fetchStoryReach(opts)).toBeNull();
});
