import { describe, it, expect } from "vitest";
import { extractArticleText } from "./article";

describe("extractArticleText", () => {
  it("pulls paragraph text out of an article body", () => {
    const html = `
      <html><head><title>x</title></head><body>
      <article>
        <p>The Reserve Bank held the cash rate at 4.35 per cent on Tuesday, the fifth straight meeting without a move.</p>
        <p>Economists at the major banks now expect the first cut to land in the second quarter of next year.</p>
      </article>
      </body></html>`;
    const text = extractArticleText(html, 6000);
    expect(text).toContain("4.35 per cent");
    expect(text).toContain("first cut to land");
    // Paragraphs are joined with a blank line.
    expect(text).toContain("\n\n");
  });

  it("strips script and style blocks so their contents never reach the text", () => {
    const html = `
      <article>
        <script>var tracking = "do not include this leaked script body";</script>
        <style>.ad { color: red; } /* do not include this css */</style>
        <p>This is the only sentence that should survive the extraction pass cleanly.</p>
      </article>`;
    const text = extractArticleText(html, 6000) ?? "";
    expect(text).toContain("only sentence that should survive");
    expect(text).not.toContain("tracking");
    expect(text).not.toContain("color: red");
  });

  it("drops short scraps like captions and share prompts", () => {
    const html = `
      <article>
        <p>Share</p>
        <p>Photo: AAP</p>
        <p>This paragraph is comfortably longer than the forty character floor and should be kept in the output.</p>
      </article>`;
    const text = extractArticleText(html, 6000) ?? "";
    expect(text).toContain("forty character floor");
    expect(text).not.toContain("Share");
    expect(text).not.toContain("Photo: AAP");
  });

  it("prefers the <article> container over surrounding chrome", () => {
    const html = `
      <body>
        <nav><p>Home News Sport Business Opinion subscribe now for full access</p></nav>
        <article><p>The actual reporting lives inside the article element and nowhere else here.</p></article>
        <footer><p>Copyright notice and a long pile of related links that should be excluded.</p></footer>
      </body>`;
    const text = extractArticleText(html, 6000) ?? "";
    expect(text).toContain("actual reporting lives inside the article");
    expect(text).not.toContain("Home News Sport");
    expect(text).not.toContain("Copyright notice");
  });

  it("falls back to a tag strip when paragraphs are built from divs", () => {
    const html = `
      <main>
        <div class="body">House prices in Sydney rose again last quarter, defying the higher-rate environment that most forecasters expected to cool demand.</div>
      </main>`;
    const text = extractArticleText(html, 6000) ?? "";
    expect(text).toContain("House prices in Sydney rose again");
  });

  it("decodes HTML entities in the extracted text", () => {
    const html = `<article><p>Borrowers &amp; lenders are watching the RBA &mdash; closely &ndash; this week ahead.</p></article>`;
    const text = extractArticleText(html, 6000) ?? "";
    expect(text).toContain("Borrowers & lenders");
    expect(text).not.toContain("&amp;");
  });

  it("caps output at the requested length", () => {
    const long = "This is a full sentence that repeats to build a long article body. ".repeat(50);
    const html = `<article><p>${long}</p></article>`;
    const text = extractArticleText(html, 200) ?? "";
    expect(text.length).toBeLessThanOrEqual(204); // 200 + optional "..."
  });

  it("returns null when there is no usable body text", () => {
    expect(extractArticleText("<html><head></head><body></body></html>", 6000)).toBeNull();
  });
});
