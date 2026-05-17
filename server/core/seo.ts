/**
 * SEO routes — sitemap.xml + feed.xml + per-edition meta tag injection.
 *
 * The XML routes pull the editions list from the database and emit
 * properly-formed XML. The edition route intercepts `/editions/:n` HTML
 * requests in production and rewrites the static index.html with the
 * edition's metaTitle / metaDescription / OG image so crawlers (Google,
 * LinkedIn, Twitter) see the right preview without needing JS.
 *
 * The site URL comes from env.SITE_URL; falls back to the constant so
 * it works in dev without an explicit value.
 */
import type { Express, Request, Response, NextFunction } from "express";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SITE_URL } from "../../shared/const";
import * as db from "../db";
import { renderEditionCard } from "../og/editionCard";

function siteUrl(req: Request): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  if (host) return `${proto}://${host}`;
  return DEFAULT_SITE_URL;
}

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
 * Intercept `/editions/:n` HTML requests, look up the edition, and serve
 * the static index.html with that edition's meta tags substituted in.
 * Production only — in dev the vite middleware owns the catch-all.
 *
 * Calls next() (falling through to the SPA shell) on any miss: bad
 * editionNumber, edition not found, non-HTML accept header, missing build,
 * or any DB error. The client-side useEditionMeta hook still runs after
 * load, so the live page is correct either way.
 */
async function handleEditionMeta(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const editionNumber = parseInt(req.params.n ?? "", 10);
    if (!Number.isFinite(editionNumber)) return next();

    const accept = req.headers.accept ?? "";
    if (!accept.includes("text/html")) return next();

    const distPath = path.resolve(process.cwd(), "dist", "public");
    const indexPath = path.resolve(distPath, "index.html");
    if (!fs.existsSync(indexPath)) return next();

    const edition = await db.getEditionByNumber(editionNumber);
    if (!edition) return next();

    let html = await fs.promises.readFile(indexPath, "utf-8");

    const title =
      edition.metaTitle ??
      `Edition ${edition.editionNumber} · ${edition.weekRange}`;
    const description =
      edition.metaDescription ??
      edition.rubensTake ??
      `Weekly intelligence for property partnerships — Edition ${edition.editionNumber}.`;
    const ogTitle = edition.socialTitle ?? title;
    const ogDescription = edition.socialDescription ?? description;
    // Branded per-edition OG card — same surface as the masthead, so
    // a LinkedIn / X / Slack share preview reads as continuous with
    // the site rather than as whatever hero illustration we happened
    // to stock the article with.
    const ogImage = `${siteUrl(req)}/og/editions/${edition.editionNumber}.png`;
    const canonical = `${siteUrl(req)}/editions/${edition.editionNumber}`;

    // Replace the static defaults in place.
    html = html
      .replace(
        /<title>[\s\S]*?<\/title>/,
        `<title>${htmlEscape(title)} — The Desk</title>`
      )
      .replace(
        /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
        `<meta name="description" content="${htmlEscape(description)}" />`
      )
      .replace(
        /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
        `<meta property="og:title" content="${htmlEscape(ogTitle)}" />`
      )
      .replace(
        /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
        `<meta property="og:description" content="${htmlEscape(ogDescription)}" />`
      );

    // Append the tags index.html doesn't ship by default. og:type flips
    // to "article" for editions; the rest are additive. The default
    // index.html already declares og:image at 1200x630 pointing at the
    // homepage card, so we override that to the per-edition card here
    // (the in-place rewrite below replaces the existing tag).
    const additions = [
      `<meta property="og:type" content="article" />`,
      `<meta property="og:url" content="${htmlEscape(canonical)}" />`,
      `<meta name="twitter:title" content="${htmlEscape(ogTitle)}" />`,
      `<meta name="twitter:description" content="${htmlEscape(ogDescription)}" />`,
      `<meta name="twitter:image" content="${htmlEscape(ogImage)}" />`,
      `<link rel="canonical" href="${htmlEscape(canonical)}" />`,
    ].join("\n    ");

    html = html.replace(
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:image" content="${htmlEscape(ogImage)}" />`
    );

    html = html.replace("</head>", `    ${additions}\n  </head>`);

    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300");
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
 * Serve a stored AI-generated image (hero or substack) for an edition.
 * URL: /api/images/edition/:id/:kind  → returns the binary with the
 * stored content-type. 404 if the edition has no asset of that kind.
 * Aggressively cacheable — images regenerate at most once a week.
 */
async function handleEditionImage(
  req: Request,
  res: Response
): Promise<void> {
  const id = parseInt(req.params.id ?? "", 10);
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
    console.warn(
      `[seo] edition image fetch failed for ${id}/${kind}:`,
      (err as Error).message
    );
    res.status(500).send("Image fetch failed");
  }
}

/**
 * Serve a hero-library image. URL: /api/images/hero-library/:id. Same
 * aggressive cache headers as edition images — library bytes never
 * mutate in place (admins delete + replace), so an immutable cache is
 * safe.
 */
async function handleHeroLibraryImage(
  req: Request,
  res: Response
): Promise<void> {
  const id = parseInt(req.params.id ?? "", 10);
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
    console.warn(
      `[seo] hero library fetch failed for ${id}:`,
      (err as Error).message
    );
    res.status(500).send("Image fetch failed");
  }
}

/**
 * Branded OG card for an edition. Rendered with satori + resvg from
 * the bundled Playfair / JetBrains Mono TTFs (see server/og). Cached
 * in memory per-edition and immutable downstream — the cache key
 * busts whenever the edition is republished, so an updated headline
 * propagates to the next preview without manual purging.
 */
async function handleEditionOgCard(
  req: Request,
  res: Response
): Promise<void> {
  const editionNumber = parseInt(req.params.n ?? "", 10);
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

  app.get("/sitemap.xml", async (req: Request, res: Response) => {
    const base = siteUrl(req);
    const editions = await db.listEditions().catch(() => []);

    const staticPaths = ["/", "/editions", "/archive", "/trends", "/about", "/editorial-standards", "/privacy", "/terms"];

    const urls: string[] = [];
    for (const path of staticPaths) {
      urls.push(
        `<url><loc>${base}${path}</loc><changefreq>${path === "/" ? "daily" : "weekly"}</changefreq></url>`
      );
    }
    for (const edition of editions) {
      const lastmod = edition.publishedAt
        ? new Date(edition.publishedAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      urls.push(
        `<url><loc>${base}/editions/${edition.editionNumber}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq></url>`
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
    const base = siteUrl(req);
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
    <description>Daily intelligence for property partnerships, curated by Ruben Laubscher.</description>
    <language>en-AU</language>
${items}
  </channel>
</rss>`;
    res.set("Content-Type", "application/rss+xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=600");
    res.send(xml);
  });
}
