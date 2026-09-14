import { expect, it } from "vitest";
import { isAbcMarketLiveblog, extractMarketClose } from "./marketLiveblog";
import { isVerifiedReiwaRelease } from "./reiwaRelease";
import { extractArticleText } from "./article";
import { parseIndexSource } from "./indexSource";
import { SOURCES } from "../sources";

it.each(["asx-markets-business-news-live-updates", "asx-markets-business-live-news-september-14"])(
  "recognises reviewed ABC market liveblog format %s but never uses an undated opening",
  (slug) => {
    const url = `https://www.abc.net.au/news/2026-09-14/${slug}/107148618`;
    expect(isAbcMarketLiveblog(url)).toBe(true);
    expect(
      extractMarketClose(
        "<article><p>Wall Street rose while Australian markets awaited the opening.</p></article>",
        url
      )
    ).toBeNull();
  }
);
it.each([
  "https://www.abc.net.au/news/2026-09-14/mortgage-war-return-banks/107134688",
  "https://www.abc.net.au.evil.example/news/2026-09-14/asx-markets-business-live-news/123",
])("does not treat another article as an ABC market liveblog: %s", (url) => {
  expect(isAbcMarketLiveblog(url)).toBe(false);
});
const attribution =
  '<div class="main-article-body"><div class="caption">REIWA</div><p>WA affordability reporting.</p></div>';
const reference =
  '<div class="shim-detail">Public Release. <a dhref="https://reiwa.com.au/news/report/">View in full here</a></div>';
it("requires body attribution AND a verified original release reference, not sidebar tags", () => {
  expect(isVerifiedReiwaRelease(attribution + reference)).toBe(true);
  expect(isVerifiedReiwaRelease(reference)).toBe(false);
  expect(isVerifiedReiwaRelease(attribution)).toBe(false);
  expect(
    isVerifiedReiwaRelease(
      attribution + reference.replace("reiwa.com.au/", "reiwa.com.au.evil.example/")
    )
  ).toBe(false);
  expect(
    isVerifiedReiwaRelease(attribution.replace("main-article-body", "sidebar") + reference)
  ).toBe(false);
});
it("reads the explicit FAAA body rather than its related article cards", () => {
  const text =
    "Australian financial advisers have responded to proposed consumer compensation reforms. The association says final rules and funding details still need to be settled.";
  const html = `<div class="elementor-widget-theme-post-content"><p>${text}</p></div><article><p>Unrelated claims about a different event should not become evidence.</p></article>`;
  expect(extractArticleText(html, 6000, "https://faaa.au/release/")).toBe(text);
  expect(
    extractArticleText(
      "<article><p>Unrelated article card that should not become original reporting.</p></article>",
      6000,
      "https://faaa.au/release/"
    )
  ).toBeNull();
});
it("excludes the National Tribune global ticker and sidebar from REIWA discovery", () => {
  const source = SOURCES.find((s) => s.name === "REIWA public releases (National Tribune)")!;
  const html =
    '<div class="ticker"><a href="/offtopic/">Breaking international football news</a></div><div class="entry-innerwrap"><a href="/housing-release/">WA housing and rental affordability at record lows</a></div>';
  expect(parseIndexSource(html, source).map((r) => r.url)).toEqual([
    "https://www.nationaltribune.com.au/housing-release/",
  ]);
});
it("reads ABA's release body without the related transcript and news cards", () => {
  const text = "The Australian Banking Association is reminding merchants about the implementation of card surcharge changes and the reduction in payment costs.";
  const html = `<main><div class="with-share"><p>${text}</p></div><article><p>An unrelated mortgage fraud interview is not part of this original release.</p></article></main>`;
  expect(extractArticleText(html, 6000, "https://www.ausbanking.org.au/release/")).toBe(text);
  expect(extractArticleText("<article><p>An unrelated mortgage fraud interview is not part of this original release.</p></article>", 6000, "https://www.ausbanking.org.au/release/")).toBeNull();
});
