import { expect, it } from "vitest";
import { publicMediaFields } from "./publicPostGallery";
it("uses the published video thumbnail and projects only safe public fields", () => {
  expect(
    publicMediaFields({
      media_type: "VIDEO",
      thumbnail_url: "https://scontent.cdninstagram.com/cover.jpg",
      media_url: "https://scontent.cdninstagram.com/reel.mp4",
      caption: "The actual published hook\nExtra text",
      permalink: "https://www.instagram.com/reel/ABC/",
      access_token: "private",
    })
  ).toEqual({
    thumbnail: "https://scontent.cdninstagram.com/cover.jpg",
    captionTitle: "The actual published hook",
    permalink: "https://www.instagram.com/reel/ABC/",
  });
});
it("does not expose arbitrary image destinations or guessed post links", () => {
  expect(
    publicMediaFields({
      media_url: "https://cdninstagram.com.evil.test/image",
      permalink: "javascript:alert(1)",
    })
  ).toMatchObject({ thumbnail: null, permalink: null });
});
