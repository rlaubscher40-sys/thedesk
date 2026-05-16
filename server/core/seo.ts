/**
 * SEO routes — sitemap.xml + feed.xml.
 *
 * Both pull the editions list from the database (or demo store) and emit
 * properly-formed XML. The site URL comes from env.SITE_URL; falls back
 * to the constant so it works in dev without an explicit value.
 */
import type { Express, Request, Response } from "express";
import { DEFAULT_SITE_URL } from "../../shared/const";
import * as db from "../db";

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

export function registerSeoRoutes(app: Express): void {
  app.get("/sitemap.xml", async (req: Request, res: Response) => {
    const base = siteUrl(req);
    const editions = await db.listEditions().catch(() => []);

    const staticPaths = ["/", "/editions", "/trends", "/about", "/editorial-standards", "/privacy", "/terms"];

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
