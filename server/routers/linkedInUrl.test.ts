import { expect, it } from "vitest";
import { postUrlSchema } from "./linkedIn";
it.each(["https://linkedin.com/posts/example", "https://www.linkedin.com/posts/example"])(
  "accepts %s",
  (url) => {
    expect(postUrlSchema.safeParse(url).success).toBe(true);
  }
);
it.each([
  "https://linkedin.com.evil.example/post",
  "https://evil.example/?next=linkedin.com",
  "https://linkedin.com@evil.example/post",
  "https://evil.example/linkedin.com",
  "http://linkedin.com/post",
  "https://user@www.linkedin.com/post",
  "https://www.linkedin.com:8443/post",
  "javascript:alert('linkedin.com')",
])("rejects %s", (url) => {
  expect(postUrlSchema.safeParse(url).success).toBe(false);
});
