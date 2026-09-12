import { afterEach, describe, it, expect, vi } from "vitest";
vi.mock("./publicFetch", () => ({
  publicFetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
}));
import { extractArticleText, fetchArticle } from "./article";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("bounded article fetching", () => {
  it("extracts original publication metadata from the same bounded fetch", async () => {
    const request = vi.fn(
      async () =>
        new Response(
          '<meta property="article:published_time" content="2026-04-01T00:00:00Z"><article><p>This original reporting is long enough to be retained with its original publication date.</p></article>',
          { headers: { "content-type": "text/html" } }
        )
    );
    vi.stubGlobal("fetch", request);
    const article = await fetchArticle("https://example.com/article");
    expect(request).toHaveBeenCalledOnce();
    expect(article.publicationDate).toEqual({
      publisherPublishedAt: "2026-04-01T00:00:00.000Z",
      publisherDateStatus: "available",
    });
    expect(article.text).toContain("original reporting");
  });
  it("times out a body that stalls after successful response headers", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (_url, opts) =>
          new Response(
            new ReadableStream({
              start(controller) {
                opts.signal.addEventListener("abort", () => controller.error(new Error("aborted")));
              },
            }),
            { headers: { "content-type": "text/html" } }
          )
      )
    );
    const pending = fetchArticle("https://example.com/article", { timeoutMs: 100 });
    await vi.advanceTimersByTimeAsync(101);
    expect(await pending).toEqual({
      fetchFailure: "article-timeout",
      imageUrl: null,
      text: null,
      publicationDate: { publisherPublishedAt: null, publisherDateStatus: "missing" },
    });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not decode beyond the byte budget even when one chunk is oversized", async () => {
    const prefix =
      "<article><p>This is the only sourced paragraph that fits within the permitted byte budget.</p></article>";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            prefix +
              "<p>This extra claim must not appear in the extracted body under any circumstances.</p>",
            { headers: { "content-type": "text/html; charset=utf-8" } }
          )
      )
    );
    const result = await fetchArticle("https://example.com/article", {
      maxBytes: Buffer.byteLength(prefix),
    });
    expect(result.text).toContain("only sourced paragraph");
    expect(result.text).not.toContain("extra claim");
  });
  it("does not interpret binary or JSON responses as reporting", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response('{"text":"This is not an HTML article and cannot ground the reporting."}', {
            headers: { "content-type": "application/json" },
          })
      )
    );
    expect(await fetchArticle("https://example.com/article")).toEqual({
      fetchFailure: "article-unsupported-content-type",
      imageUrl: null,
      text: null,
      publicationDate: { publisherPublishedAt: null, publisherDateStatus: "missing" },
    });
  });
});

describe("extractArticleText", () => {
  it("removes paywall/consent text before it can ground intelligence", () => {
    const reporting =
      "The official dwelling approvals series increased over the latest reference month.";
    const gate =
      "Subscribe to continue reading this article and unlock unlimited access to all our stories.";
    expect(extractArticleText(`<article><p>${gate}</p><p>${reporting}</p></article>`, 6000)).toBe(
      reporting
    );
    expect(extractArticleText(`<main><p>${gate}</p></main>`, 6000)).toBeNull();
  });
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

it.each([403, 429, 503])(
  "records HTTP %i without treating denied content as editorial evidence",
  async (status) => {
    const request = vi.fn(async () => new Response("Untrusted error page", { status }));
    vi.stubGlobal("fetch", request);
    expect(await fetchArticle("https://example.com/article")).toMatchObject({
      fetchFailure: `article-http-${status}`,
      text: null,
    });
    expect(request).toHaveBeenCalledOnce();
  }
);
it("keeps network failures separate from genuinely empty HTML", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("private network detail");
    })
  );
  expect(await fetchArticle("https://example.com/article")).toMatchObject({
    fetchFailure: "article-fetch-failed",
    text: null,
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () => new Response("<article></article>", { headers: { "content-type": "text/html" } })
    )
  );
  const empty = await fetchArticle("https://example.com/article");
  expect(empty.text).toBeNull();
  expect(empty.fetchFailure).toBeUndefined();
});
