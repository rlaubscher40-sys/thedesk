/**
 * Meta injection: the pure half of seo.ts, exercised against the real
 * client/index.html rather than a hand-rolled stub, so a change to the
 * shell that breaks one of the in-place rewrites fails here.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { absoluteImageUrl, clampDescription, injectMeta, type PageMeta } from "./seo";

const SHELL = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../client/index.html"),
  "utf-8"
);

const META: PageMeta = {
  title: "RBA holds at 3.85%",
  description: "What the hold means for broker conversations this week.",
  ogTitle: "RBA holds at 3.85%",
  ogDescription: "What the hold means for broker conversations this week.",
  ogImage: "https://thedesk.au/og/editions/12.png",
  canonical: "https://thedesk.au/editions/12",
  jsonLd: { "@context": "https://schema.org", "@type": "NewsArticle" },
};

function countOf(html: string, re: RegExp): number {
  return html.match(re)?.length ?? 0;
}

describe("injectMeta", () => {
  const out = injectMeta(SHELL, META);

  it("replaces the shell's title rather than adding one", () => {
    expect(countOf(out, /<title>/g)).toBe(1);
    expect(out).toContain("<title>RBA holds at 3.85%, The Desk</title>");
  });

  it("replaces the description and OG tags in place", () => {
    expect(countOf(out, /<meta\s+name="description"/g)).toBe(1);
    expect(countOf(out, /<meta\s+property="og:title"/g)).toBe(1);
    expect(countOf(out, /<meta\s+property="og:description"/g)).toBe(1);
    expect(out).toContain(`content="${META.description}"`);
  });

  it("points og:image at the page's own card, once", () => {
    expect(countOf(out, /<meta\s+property="og:image"\s/g)).toBe(1);
    expect(out).toContain(`<meta property="og:image" content="${META.ogImage}" />`);
  });

  it("leaves exactly one canonical, the page's own", () => {
    // Two canonicals make Google ignore both — the failure mode that
    // shows up as "Alternative page with proper canonical tag".
    expect(countOf(out, /<link\s+rel="canonical"/g)).toBe(1);
    expect(out).toContain(`<link rel="canonical" href="${META.canonical}" />`);
    expect(out).not.toContain('href="https://thedesk.au/"');
  });

  it("flips og:type to article without leaving the website one behind", () => {
    expect(countOf(out, /<meta\s+property="og:type"/g)).toBe(1);
    expect(out).toContain('<meta property="og:type" content="article" />');
    expect(out).not.toContain('content="website"');
  });

  it("points og:url at this page, once", () => {
    expect(countOf(out, /<meta\s+property="og:url"/g)).toBe(1);
    expect(out).toContain(`<meta property="og:url" content="${META.canonical}" />`);
  });

  it("overwrites the shell's twitter tags rather than doubling them", () => {
    // Every scraper reads the first tag it meets, so a duplicate left
    // behind means the share card shows the homepage copy.
    expect(countOf(out, /<meta\s+name="twitter:title"/g)).toBe(1);
    expect(countOf(out, /<meta\s+name="twitter:description"/g)).toBe(1);
    expect(countOf(out, /<meta\s+name="twitter:image"/g)).toBe(1);
    expect(out).toContain(`<meta name="twitter:image" content="${META.ogImage}" />`);
  });

  it("leaves no homepage copy in any meta tag", () => {
    // The site-level WebSite/Organization JSON-LD keeps describing the
    // site — that's correct. It's the <meta> tags that must all be the
    // article's.
    const metaTags = out.match(/<meta\s[^>]*>/g) ?? [];
    for (const tag of metaTags) {
      expect(tag, tag).not.toContain("60-second morning scan");
      expect(tag, tag).not.toContain("Daily intelligence for the property industry");
    }
  });

  it("keeps everything inside <head>", () => {
    const head = out.slice(0, out.indexOf("</head>"));
    expect(head).toContain(META.canonical);
    expect(head).toContain("application/ld+json");
  });

  it("escapes markup in the title and description", () => {
    const out2 = injectMeta(SHELL, { ...META, title: `Fear & "greed" <b>` });
    expect(out2).toContain("<title>Fear &amp; &quot;greed&quot; &lt;b&gt;, The Desk</title>");
  });

  it("neutralises a </script> hidden in the JSON-LD", () => {
    const out2 = injectMeta(SHELL, {
      ...META,
      jsonLd: { headline: "</script><img src=x onerror=alert(1)>" },
    });
    const block = out2.slice(out2.indexOf("application/ld+json"));
    expect(block).not.toContain("</script><img");
    expect(block).toContain("\\u003c/script");
  });
});

describe("absoluteImageUrl", () => {
  it("passes an absolute outlet URL straight through", () => {
    expect(absoluteImageUrl("https://cdn.afr.com/x.jpg")).toBe("https://cdn.afr.com/x.jpg");
  });

  it("absolutises a site-relative hero-library URL", () => {
    expect(absoluteImageUrl("/api/images/hero-library/7")).toBe(
      "https://thedesk.au/api/images/hero-library/7"
    );
  });

  it("falls back to the brand card for null or junk", () => {
    expect(absoluteImageUrl(null)).toBe("https://thedesk.au/og-card.png");
    expect(absoluteImageUrl("")).toBe("https://thedesk.au/og-card.png");
    expect(absoluteImageUrl("data:image/png;base64,xx")).toBe("https://thedesk.au/og-card.png");
  });
});

describe("clampDescription", () => {
  it("leaves a short description alone", () => {
    expect(clampDescription("  Rates held.  ")).toBe("Rates held.");
  });

  it("collapses whitespace", () => {
    expect(clampDescription("Rates\n  held\ttoday.")).toBe("Rates held today.");
  });

  it("trims on a word boundary and marks the cut", () => {
    const out = clampDescription("word ".repeat(60));
    expect(out.length).toBeLessThanOrEqual(161);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toContain("wor…");
  });

  it("still cuts when there's no boundary to use", () => {
    const out = clampDescription("x".repeat(400), 20);
    expect(out).toBe(`${"x".repeat(20)}…`);
  });
});
