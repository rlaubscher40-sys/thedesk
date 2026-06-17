import { describe, it, expect } from "vitest";
import { pickRssImage } from "./rss";

describe("pickRssImage", () => {
  it("returns the media:content image url", () => {
    expect(
      pickRssImage({
        mediaContent: { $: { url: "https://cdn.example.com/lead.jpg", medium: "image" } },
      })
    ).toBe("https://cdn.example.com/lead.jpg");
  });

  it("picks the first image-typed node from an array of media:content", () => {
    expect(
      pickRssImage({
        mediaContent: [
          { $: { url: "https://cdn.example.com/clip.mp4", medium: "video" } },
          { $: { url: "https://cdn.example.com/photo.jpg", medium: "image" } },
        ],
      })
    ).toBe("https://cdn.example.com/photo.jpg");
  });

  it("falls back to media:thumbnail, then enclosure", () => {
    expect(
      pickRssImage({ mediaThumbnail: { $: { url: "https://cdn.example.com/thumb.jpg" } } })
    ).toBe("https://cdn.example.com/thumb.jpg");
    expect(
      pickRssImage({ enclosure: { url: "https://cdn.example.com/encl.jpg", type: "image/jpeg" } })
    ).toBe("https://cdn.example.com/encl.jpg");
  });

  it("ignores non-image enclosures and non-http urls", () => {
    expect(
      pickRssImage({ enclosure: { url: "https://cdn.example.com/audio.mp3", type: "audio/mpeg" } })
    ).toBeNull();
    expect(pickRssImage({ mediaContent: { $: { url: "//protocol-relative.jpg" } } })).toBeNull();
    expect(pickRssImage({})).toBeNull();
  });
});
