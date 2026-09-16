import { expect, it } from "vitest";
import { analyticsReferrer } from "./analyticsReferrer";
it("keeps only hostnames from web URLs and already-reduced hosts", () => {
  expect(analyticsReferrer("https://reader:secret@www.example.com/path?q=email#token")).toBe(
    "www.example.com"
  );
  expect(analyticsReferrer("www.example.com")).toBe("www.example.com");
  expect(analyticsReferrer("localhost:3000")).toBe("localhost");
});
it("discards malformed, non-web or potentially identifying fallback strings", () => {
  for (const value of [
    undefined,
    "",
    "reader@example.com",
    "mailto:reader@example.com",
    "private text/token",
    "data:text/plain,private",
    "/private/path",
    "//example.com/private",
  ])
    expect(analyticsReferrer(value)).toBeNull();
});
