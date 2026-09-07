/**
 * SEO routes, sitemap.xml + feed.xml + per-page meta tag injection.
 *
 * The XML routes pull the editions list from the database and emit
 * properly-formed XML. The article routes intercept `/editions/:n` and
 * `/story/:id` HTML requests in production and rewrite the static
 * index.html with that page's title / description / canonical / OG image
 * so crawlers (Google, LinkedIn, Twitter) see the right thing without
 * needing JS — and so a story shared to LinkedIn stops previewing as the
 * generic homepage card.
 *
 * The site URL comes from env.SITE_URL; falls back to the constant so
 * it works in dev without an explicit value.
 */
import type { Express, Request, Response, NextFunction } from "express";
import fs from "node:fs";
import { routeParam } from "./requestParams";
import path from "node:path";
import { siteUrl } from "./siteUrl";
import { withNoindex } from "./spaShell";
import * as db from "../db";
import { renderEditionCard } from "../og/editionCard";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Read the built SPA shell, or null when there isn't one (dev, where the
 * vite middleware owns the catch-all, or a broken build).
 */
async function readShell(): Promise<string | null> {
  const indexPath = path.resolve(process.cwd(), "dist", "public", "index.html");
  if (!fs.existsSync(indexPath)) return null;
  return fs.promises.readFile(indexPath, "utf-8");
}

export interface PageMeta {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  canonical: string;
  /** JSON-LD document for the page, serialised into a script block. */
  jsonLd: unknown;
}

/**
 * Replace the first tag matching `find`, or queue the replacement for
 * append when the shell doesn't carry that tag at all.
 *
 * Replace-or-append, never blind append: index.html ships homepage
 * defaults for og:type, og:url and all three twitter:* tags, and simply
 * adding the article's versions after them left two of each in the head.
 * Every consumer — Google, LinkedIn, Slack, X — reads the first one it
 * meets, so the duplicates meant a shared edition previewed with the
 * homepage's title, description and card no matter what we appended.
 */
function upsertTag(html: string, find: RegExp, tag: string, pending: string[]): string {
  if (find.test(html)) return html.replace(find, tag);
  pending.push(tag);
  return html;
}

/**
 * Rewrite the shell's static homepage meta into this page's.
 */
export function injectMeta(shell: string, meta: PageMeta): string {
  const pending: string[] = [];
  let html = shell.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>${htmlEscape(meta.title)}, The Desk</title>`
  );

  const tags: [RegExp, string][] = [
    [
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
      `<meta name="description" content="${htmlEscape(meta.description)}" />`,
    ],
    [
      /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:type" content="article" />`,
    ],
    [
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:url" content="${htmlEscape(meta.canonical)}" />`,
    ],
    [
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:title" content="${htmlEscape(meta.ogTitle)}" />`,
    ],
    [
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:description" content="${htmlEscape(meta.ogDescription)}" />`,
    ],
    [
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:image" content="${htmlEscape(meta.ogImage)}" />`,
    ],
    [
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/,
      `<meta name="twitter:title" content="${htmlEscape(meta.ogTitle)}" />`,
    ],
    [
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/,
      `<meta name="twitter:description" content="${htmlEscape(meta.ogDescription)}" />`,
    ],
    [
      /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/,
      `<meta name="twitter:image" content="${htmlEscape(meta.ogImage)}" />`,
    ],
    // Two <link rel=canonical> tags on a page make Google ignore both,
    // which is how an article ends up filed as "Alternative page with
    // proper canonical tag" pointing at the homepage instead of ranking
    // on its own. The shell's homepage canonical is overwritten, not
    // supplemented.
    [
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
      `<link rel="canonical" href="${htmlEscape(meta.canonical)}" />`,
    ],
  ];
  for (const [find, tag] of tags) html = upsertTag(html, find, tag, pending);

  // The shell's JSON-LD is the site-level WebSite/Organization block; the
  // article schema is a second, additive statement, so this one is always
  // an append. JSON.stringify doesn't escape `<`, so a `</script>` inside
  // a headline would terminate the block and inject markup — the escape
  // decodes back to `<` for any JSON-LD consumer.
  pending.push(
    `<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, "\\u003c")}</script>`
  );

  return html.replace("</head>", `    ${pending.join("\n    ")}\n  </head>`);
}

/** The publisher block every article schema on the site repeats. */
function publisherSchema() {
  return {
    "@type": "Organization",
    name: "The Desk",
    url: siteUrl(),
    logo: {
      "@type": "ImageObject",
      url: `${siteUrl()}/og-card.png`,
      width: 1200,
      height: 630,
    },
  };
}

/**
 * Serve the shell as a 404 for an article URL whose row doesn't exist.
 *
 * A deleted edition or a mistyped story id used to answer 200 with the
 * app shell, which is a soft 404: Google keeps the URL, recrawls it, and
 * files it under "Crawled — currently not indexed". The reader still gets
 * the styled "Transmission lost" page, the crawler gets the status code.
 */
function sendArticleNotFound(res: Response, shell: string): void {
  res.status(404);
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(withNoindex(shell));
}

/**
 * Intercept `/editions/:n` HTML requests, look up the edition, and serve
 * the static index.html with that edition's meta tags substituted in.
 * Production only, in dev the vite middleware owns the catch-all.
 *
 * Calls next() (falling through to the SPA shell) when we can't do the
 * job: bad editionNumber, non-HTML accept header, missing build, or any
 * DB error. The client-side useEditionMeta hook still runs after load, so
 * the live page is correct either way. An edition that genuinely isn't
 * there is the one case that stops rather than falling through — it 404s.
 */
async function handleEditionMeta(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const editionNumber = parseInt(routeParam(req.params.n), 10);
    if (!Number.isFinite(editionNumber)) return next();

    const accept = req.headers.accept ?? "";
    if (!accept.includes("text/html")) return next();

    const shell = await readShell();
    if (shell === null) return next();

    const edition = await db.getEditionByNumber(editionNumber);
    if (!edition) return sendArticleNotFound(res, shell);

    const title = edition.metaTitle ?? `Edition ${edition.editionNumber} · ${edition.weekRange}`;
    const description =
      edition.metaDescription ??
      edition.rubensTake ??
      `Weekly intelligence for the property industry, Edition ${edition.editionNumber}.`;
    const ogTitle = edition.socialTitle ?? title;
    const ogDescription = edition.socialDescription ?? description;
    // Branded per-edition OG card, same surface as the masthead, so
    // a LinkedIn / X / Slack share preview reads as continuous with
    // the site rather than as whatever hero illustration we happened
    // to stock the article with.
    const ogImage = `${siteUrl()}/og/editions/${edition.editionNumber}.png`;
    const canonical = `${siteUrl()}/editions/${edition.editionNumber}`;

    const publishedIso = edition.publishedAt
      ? new Date(edition.publishedAt).toISOString()
      : new Date().toISOString();

    const html = injectMeta(shell, {
      title,
      description,
      ogTitle,
      ogDescription,
      ogImage,
      canonical,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        headline: title,
        description: description,
        image: ogImage,
        url: canonical,
        datePublished: publishedIso,
        dateModified: publishedIso,
        author: {
          "@type": "Person",
          name: "Ruben Laubscher",
          jobTitle: "Head of Partnerships",
          url: `${siteUrl()}/about`,
        },
        publisher: publisherSchema(),
        isPartOf: {
          "@type": "Periodical",
          name: "The Desk",
          url: siteUrl(),
        },
      },
    });

    res.set("Content-Type", "text/html; charset=utf-8");
    // Never let an intermediary serve this shell without revalidating: it
    // hard-codes the current content-hashed chunk filenames, so a stale
    // copy (the old max-age=300 allowed up to 5 min of it) makes the
    // browser request chunks a fresh deploy has already deleted —
    // "Failed to fetch dynamically imported module". `no-cache` still
    // permits efficient 304s, it just forces a revalidation first.
    res.set("Cache-Control", "no-cache");
    res.send(html);
  } catch (err) {
    console.warn(
      `[seo] edition meta injection failed for ${req.params.n}:`,
      (err as Error).message
    );
    next();
  }
}

/**
 * Resolve a stored image URL to something a crawler can fetch. Feed items
 * carry either an absolute outlet URL or a site-relative
 * `/api/images/hero-library/:id`; og:image has to be absolute either way.
 * Falls back to the brand card so a share preview is never blank.
 */
export function absoluteImageUrl(stored: string | null | undefined): string {
  if (!stored) return `${siteUrl()}/og-card.png`;
  if (/^https?:\/\//i.test(stored)) return stored;
  if (stored.startsWith("/")) return `${siteUrl()}${stored}`;
  return `${siteUrl()}/og-card.png`;
}

/**
 * Trim to a meta-description length without cutting mid-word. Google
 * truncates around 155-160 characters; anything past that is wasted, and
 * a description that ends mid-syllable reads as broken in a share card.
 */
export function clampDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:\s]+$/, "")}…`;
}

/**
 * The same treatment for `/story/:id`.
 *
 * Story pages are where LinkedIn links land, so they're the pages most
 * likely to earn an inbound link — and they were the ones with the least
 * for a crawler to work with: the shell's homepage title, the homepage
 * description, the homepage OG card, and the homepage canonical, with the
 * real headline arriving only once React had fetched it. That reads as a
 * near-duplicate of the homepage, which is how a story ends up "Crawled —
 * currently not indexed".
 */
async function handleStoryMeta(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(routeParam(req.params.id), 10);
    if (!Number.isFinite(id) || id <= 0) return next();

    const accept = req.headers.accept ?? "";
    if (!accept.includes("text/html")) return next();

    const shell = await readShell();
    if (shell === null) return next();

    const story = await db.getFeedItemById(id);
    if (!story) return sendArticleNotFound(res, shell);

    const title = story.title;
    const description = clampDescription(
      story.whyItMatters ?? story.summary ?? `${story.source} — reported on The Desk.`
    );
    const ogImage = absoluteImageUrl(story.imageUrl);
    const canonical = `${siteUrl()}/story/${story.id}`;
    // feedDate is a plain YYYY-MM-DD; treat it as midnight UTC rather than
    // letting the server's zone shift a story into the wrong day.
    const publishedIso = new Date(`${story.feedDate}T00:00:00Z`).toISOString();

    const html = injectMeta(shell, {
      title,
      description,
      ogTitle: title,
      ogDescription: description,
      ogImage,
      canonical,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        headline: title,
        description,
        image: ogImage,
        url: canonical,
        datePublished: publishedIso,
        dateModified: publishedIso,
        articleSection: story.category,
        author: {
          "@type": "Organization",
          name: "The Desk",
          url: siteUrl(),
        },
        publisher: publisherSchema(),
      },
    });

    res.set("Content-Type", "text/html; charset=utf-8");
    // Same reasoning as the edition shell: no-cache, never a stale copy
    // pointing at chunk hashes a deploy has already replaced.
    res.set("Cache-Control", "no-cache");
    res.send(html);
  } catch (err) {
    console.warn(`[seo] story meta injection failed for ${req.params.id}:`, (err as Error).message);
    next();
  }
}

/**
 * Serve a stored AI-generated image (hero or substack) for an edition.
 * URL: /api/images/edition/:id/:kind  → returns the binary with the
 * stored content-type. 404 if the edition has no asset of that kind.
 * Aggressively cacheable, images regenerate at most once a week.
 */
async function handleEditionImage(req: Request, res: Response): Promise<void> {
  const id = parseInt(routeParam(req.params.id), 10);
  const kind = req.params.kind === "substack" ? "substack" : "hero";
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).send("Bad id");
    return;
  }
  try {
    const asset = await db.getLatestEditionAsset(id, kind);
    if (!asset) {
      res.status(404).send("Not found");
      return;
    }
    res.set("Content-Type", asset.contentType);
    res.set("Cache-Control", "public, max-age=86400, immutable");
    res.send(asset.bytes);
  } catch (err) {
    console.warn(`[seo] edition image fetch failed for ${id}/${kind}:`, (err as Error).message);
    res.status(500).send("Image fetch failed");
  }
}

/**
 * Serve a hero-library image. URL: /api/images/hero-library/:id. Same
 * aggressive cache headers as edition images, library bytes never
 * mutate in place (admins delete + replace), so an immutable cache is
 * safe.
 */
async function handleHeroLibraryImage(req: Request, res: Response): Promise<void> {
  const id = parseInt(routeParam(req.params.id), 10);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).send("Bad id");
    return;
  }
  try {
    const row = await db.getHeroLibraryBytes(id);
    if (!row) {
      res.status(404).send("Not found");
      return;
    }
    res.set("Content-Type", row.contentType);
    res.set("Cache-Control", "public, max-age=86400, immutable");
    res.send(row.bytes);
  } catch (err) {
    console.warn(`[seo] hero library fetch failed for ${id}:`, (err as Error).message);
    res.status(500).send("Image fetch failed");
  }
}

/**
 * Branded OG card for an edition. Rendered with satori + resvg from
 * the bundled Playfair / JetBrains Mono TTFs (see server/og). Cached
 * in memory per-edition and immutable downstream, the cache key
 * busts whenever the edition is republished, so an updated headline
 * propagates to the next preview without manual purging.
 */
async function handleEditionOgCard(req: Request, res: Response): Promise<void> {
  const editionNumber = parseInt(routeParam(req.params.n), 10);
  if (!Number.isFinite(editionNumber) || editionNumber <= 0) {
    res.status(400).send("Bad edition number");
    return;
  }
  try {
    const edition = await db.getEditionByNumber(editionNumber);
    if (!edition) {
      res.status(404).send("Not found");
      return;
    }
    const png = await renderEditionCard(edition);
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=86400, immutable");
    res.send(png);
  } catch (err) {
    console.warn(
      `[seo] og card render failed for edition ${editionNumber}:`,
      (err as Error).message
    );
    // Fall through to the static brand card so the share preview still
    // looks branded rather than broken.
    res.redirect(302, "/og-card.png");
  }
}

export function registerSeoRoutes(app: Express): void {
  app.get("/api/images/edition/:id/:kind", handleEditionImage);
  app.get("/api/images/hero-library/:id", handleHeroLibraryImage);
  app.get("/og/editions/:n.png", handleEditionOgCard);
  app.get("/editions/:n", handleEditionMeta);
  app.get("/story/:id", handleStoryMeta);

  // Legacy /search → /archive. The client already forwards this route, but
  // it does it from a useEffect, so a crawler sees a 200 on /search and
  // files it as "Page with redirect" (or worse, as a duplicate) rather
  // than following a hop. A server 301 is unambiguous and doesn't need JS.
  app.get("/search", (req: Request, res: Response) => {
    const query = req.originalUrl.split("?")[1];
    res.redirect(301, query ? `/archive?${query}` : "/archive");
  });

  app.get("/sitemap.xml", async (req: Request, res: Response) => {
    const base = siteUrl();
    const editions = await db.listEditions().catch(() => []);

    // Every public page, and only public pages: /admin, /login, /settings,
    // /queue, /install and the confirm links serve `noindex` (see
    // spaShell.ts) and have no business being submitted for indexing.
    const staticPaths = [
      "/",
      "/editions",
      "/archive",
      "/trends",
      "/topics",
      "/about",
      "/editorial-standards",
      "/corrections",
      "/privacy",
      "/terms",
    ];

    // The index pages all re-render when a new edition lands, so date the
    // whole set from the newest one. Without a lastmod Google has to guess
    // how stale a URL is, and guesses conservatively.
    const newestPublished = editions.reduce<number | null>((newest, edition) => {
      const at = edition.publishedAt ? new Date(edition.publishedAt).getTime() : NaN;
      if (!Number.isFinite(at)) return newest;
      return newest === null || at > newest ? at : newest;
    }, null);
    const siteLastmod = new Date(newestPublished ?? Date.now()).toISOString().slice(0, 10);

    const urls: string[] = [];
    for (const path of staticPaths) {
      urls.push(
        `<url><loc>${base}${path}</loc><lastmod>${siteLastmod}</lastmod><changefreq>${path === "/" ? "daily" : "weekly"}</changefreq></url>`
      );
    }
    const today = new Date().toISOString().slice(0, 10);
    for (const edition of editions) {
      const publishedAt = edition.publishedAt ? new Date(edition.publishedAt) : null;
      const lastmod =
        publishedAt && Number.isFinite(publishedAt.getTime())
          ? publishedAt.toISOString().slice(0, 10)
          : today;
      // A lastmod in the future makes Google distrust every date in the
      // file, so clamp a mis-dated row back to today.
      urls.push(
        `<url><loc>${base}/editions/${edition.editionNumber}</loc><lastmod>${lastmod > today ? today : lastmod}</lastmod><changefreq>monthly</changefreq></url>`
      );
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(xml);
  });

  app.get("/feed.xml", async (req: Request, res: Response) => {
    const base = siteUrl();
    const editions = (await db.listEditions().catch(() => [])).slice(0, 50);

    const items = editions
      .map((edition) => {
        const url = `${base}/editions/${edition.editionNumber}`;
        const pub = edition.publishedAt
          ? new Date(edition.publishedAt).toUTCString()
          : new Date().toUTCString();
        const summary = (edition.rubensTake ?? edition.fullText ?? "").slice(0, 600);
        const title = xmlEscape(`Edition ${edition.editionNumber} · ${edition.weekRange}`);
        return `    <item>
      <title>${title}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pub}</pubDate>
      <description>${xmlEscape(summary)}</description>
    </item>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>The Desk</title>
    <link>${base}</link>
    <description>Daily intelligence for the property industry, curated by Ruben Laubscher.</description>
    <language>en-AU</language>
${items}
  </channel>
</rss>`;
    res.set("Content-Type", "application/rss+xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=600");
    res.send(xml);
  });
}
