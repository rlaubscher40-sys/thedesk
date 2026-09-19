import { expect, it } from "vitest";
import { documentaryReviewPlayerHtml } from "./lib/documentaryReviewPlayer";
it("packages an offline exact-export review without automatic approval or executable titles", () => {
  const html = documentaryReviewPlayerHtml({
    episodeId: "test",
    videoFile: "The-Desk-test.mp4",
    videoSha256: "a".repeat(64),
    inputHash: "b".repeat(64),
    shots: [{ start: 4.5, seconds: 3, title: "</script><script>alert(1)</script>" }],
  });
  expect(html).not.toContain("<script>alert(1)");
  expect(html).toContain('type="application/json"');
  expect(html).toContain("watchedAndListened");
  expect(html).toContain("published:false");
  expect(html).toContain("Not reviewed");
  expect(html).not.toContain("https://");
});
