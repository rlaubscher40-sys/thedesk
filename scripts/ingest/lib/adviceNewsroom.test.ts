import { expect, it } from "vitest";
import { SOURCES } from "../sources";
import { parseIndexSource } from "./indexSource";
import { extractArticleText } from "./article";
import { extractPublicationDate } from "./publicationDate";
import { articleDisclosureHold } from "./articleDisclosure";
import { buildDailyBrief } from "./editorialPipeline";

const source = SOURCES.find(s => s.name === "Financial Newswire")!;
const url = "https://financialnewswire.com.au/financial-planning/asic-adviser-bans/";
const title = "ASIC announces 5-year bans after Australian financial advice review";
// Synthetic reporting; containers model the public pages inspected 14 September.
const body = "ASIC announced a 5-year ban on an Australian financial adviser after reviewing superannuation switching advice. The decision concerns the adviser's responsibility to assess each client's circumstances and explain transaction costs. The regulator said advisers must retain responsibility for advice supplied through third parties. The findings do not establish that all financial advice firms have breached the rules. ".repeat(4);

it("uses the permitted topic index, never either blocked feed", () => {
  expect(source).toMatchObject({ kind: "index", url: "https://financialnewswire.com.au/financial-planning/" });
  expect(SOURCES.some(s => /moneymanagement\.com\.au.*feed|financialnewswire\.com\.au.*feed/.test(s.url))).toBe(false);
});

it("discovers headline containers across slider and news cards, excluding comments, other beats and adverts", () => {
  const items = parseIndexSource(`
    <h3 class="rpsw-post-title"><a href="${url}">${title}</a></h3>
    <div class="post-header"><h3><a href="/financial-planning/advice-review/">Australian financial advice review released</a></h3></div>
    <div class="post-header"><h3><a href="/industry-news/sponsored/">Australian financial advice sponsored promotion</a></h3></div>
    <div class="post-header"><h3><a href="https://other.example/financial-planning/story/">External financial advice story</a></h3></div>
    <article class="comment"><a href="/financial-planning/comment-only/#reply">An unrelated reader opinion about advisers</a></article>
    <div class="post-header"><a href="/financial-planning/">Latest financial planning category</a></div>
    <div class="post-header"><a href="${url}">Duplicate headline in a different card</a></div>`, source);
  expect(items.map(i => i.url)).toEqual([url, "https://financialnewswire.com.au/financial-planning/advice-review/"]);
  expect(items.every(i => i.isoDate === null && i.discovery === "publisher-index")).toBe(true);
});

it("uses the declared article body and holds missing templates instead of reading a comment", () => {
  expect(extractArticleText(`<div class="content-inner"><p>${body}</p></div><article><p>An unrelated reader comment outside the reporting body.</p></article>`, 6000, url)).toBe(body.trim());
  expect(extractArticleText(`<article><p>${body}</p></article>`, 6000, url)).toBeNull();
});

it("holds sponsorship in the current body, not in a sidebar", () => {
  expect(articleDisclosureHold(`<div class="content-inner"><span class="sponsored-by">Sponsored by</span><p>${body}</p></div>`, url)).toBe("publisher-disclosed-sponsored-content");
  expect(articleDisclosureHold(`<div class="content-inner"><p>${body}</p></div><aside><span class="sponsored-by">Sponsored by</span></aside>`, url)).toBeNull();
  expect(articleDisclosureHold(`<script type="application/ld+json">${JSON.stringify({"@type":"Article","@id":url+"#article",articleSection:["Sponsored Content"]})}</script>`,url)).toBe("publisher-disclosed-sponsored-content");
});

it("selects dated Australian reporting with the new publisher's attribution", async () => {
  const html = `<meta property="article:published_time" content="2026-09-14T12:13:38Z"><div class="content-inner"><p>${body}</p></div>`;
  const items = parseIndexSource(`<h3 class="rpsw-post-title"><a href="${url}">${title}</a></h3>`, source);
  const result = await buildDailyBrief({
    now: new Date("2026-09-14T13:00:00Z"), sources: [source],
    readSource: async () => ({items,fetched:items.length,error:null}),
    resolve: async u => u,
    readArticle: async () => ({text:extractArticleText(html,6000,url),publicationDate:extractPublicationDate(html,url),imageUrl:null}),
  });
  expect(result.report.decisions[0]?.reason).toBe("selected");
  expect(result.items[0]).toMatchObject({url,source:"Financial Newswire",channel:"AU",category:"POLICY",corroborationCount:1});
});
