import { expect, it } from "vitest";
import { createArticleAccess } from "./articleAccess";

it.each([401, 403])("pauses an exact denied article (%s), not every public page", (status) => {
  let now = Date.parse("2026-09-13T00:00:00Z");
  const access = createArticleAccess({ now: () => now });
  access.record("https://example.com/denied", status, null);
  expect(access.check("https://example.com/denied#section")).toBe(
    `article-cooldown-http-${status}`
  );
  expect(access.check("https://example.com/public")).toBeNull();
  now += 5 * 3600_000;
  expect(access.check("https://example.com/denied")).not.toBeNull();
  now += 3600_000;
  expect(access.check("https://example.com/denied")).toBeNull();
});

it.each(["7200", "Sun, 13 Sep 2026 02:00:00 GMT"])(
  "honours origin rate limits with Retry-After %s",
  (header) => {
    let now = Date.parse("2026-09-13T00:00:00Z");
    const access = createArticleAccess({ now: () => now });
    access.record("https://example.com/one", 429, header);
    now += 3600_000;
    expect(access.check("https://example.com/two")).toBe("article-cooldown-http-429");
    expect(access.check("https://other.example/two")).toBeNull();
    now += 3600_000;
    expect(access.check("https://example.com/two")).toBeNull();
  }
);

it("uses a safe default, bounds entries and ignores unrelated errors", () => {
  const access = createArticleAccess({ maxEntries: 1 });
  access.record("https://one.example/a", 429, "invalid");
  expect(access.check("https://one.example/b")).toBe("article-cooldown-http-429");
  access.record("https://two.example/a", 403, null);
  expect(access.check("https://one.example/b")).toBeNull();
  access.record("https://two.example/a", 500, null);
  expect(access.check("https://two.example/a")).toBe("article-cooldown-http-403");
});
