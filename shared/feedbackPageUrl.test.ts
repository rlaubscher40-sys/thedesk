import { expect, it } from "vitest";
import { feedbackPageUrl } from "./feedbackPageUrl";
it("retains only the diagnostic origin/path", () => {
  expect(
    feedbackPageUrl(
      "https://user:secret@thedesk.au/unsubscribe?token=private&utm_source=ig#private"
    )
  ).toBe("https://thedesk.au/unsubscribe");
  expect(feedbackPageUrl("https://thedesk.au/story/42?fbclid=" + "x".repeat(1000))).toBe(
    "https://thedesk.au/story/42"
  );
});
it("drops invalid schemes and overlong paths", () => {
  for (const value of [
    null,
    undefined,
    "invalid",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "https://thedesk.au/" + "x".repeat(512),
  ])
    expect(feedbackPageUrl(value)).toBeNull();
});
