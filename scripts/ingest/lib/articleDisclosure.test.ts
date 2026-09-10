import { expect, it, vi, afterEach } from "vitest";
import { articleDisclosureHold } from "./articleDisclosure";
import { fetchArticle } from "./article";
vi.mock("./publicFetch", () => ({
  publicFetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
}));
afterEach(() => vi.unstubAllGlobals());
const url = "https://www.realestate.com.au/news/a-feature/";
const marker = '<div data-testid="article-sponsored"><p>Provided by an advertiser.</p></div>';
it("recognises the publisher's rendered article disclosure", () => {
  expect(articleDisclosureHold(marker, url)).toBe("publisher-disclosed-sponsored-content");
  expect(articleDisclosureHold(marker, "https://other.example/story")).toBeNull();
});
it("ignores templates, scripts, CSS and generic advertising discussion", () => {
  for (const html of [
    `<template>${marker}</template>`,
    `<script>var example='${marker}'</script>`,
    `<style>.article-sponsored {display:block}</style>`,
    "<footer>We do not recommend sponsored lenders.</footer><article><p>This report examines sponsorship in the property industry.</p></article>",
  ])
    expect(articleDisclosureHold(html, url)).toBeNull();
});
it("holds commercial copy before it can enter any text-based downstream consumer", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          `<meta property="article:published_time" content="2026-09-10"><article><p>${"A promotional description of a new development in Australia. ".repeat(20)}</p></article>${marker}`,
          { headers: { "content-type": "text/html" } }
        )
    )
  );
  expect(await fetchArticle(url)).toMatchObject({
    text: null,
    imageUrl: null,
    editorialHold: "publisher-disclosed-sponsored-content",
  });
});
