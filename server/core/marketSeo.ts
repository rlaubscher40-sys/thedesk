import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicMarketRead } from "../../shared/PublicMarketRead";
import {
  marketPath,
  publicMarket,
  type MarketDirectory,
  type PublicMarketFile,
} from "../../shared/marketDirectory";
import { getMarketDirectory } from "../markets/discovery";
import { renderDeskTakeCard, type DeskTakeCardInput } from "../og/takeCard";
import { cached } from "./cache";
import { routeParam } from "./requestParams";
import { injectMeta } from "./seo";
import { siteUrl } from "./siteUrl";
import { withNoindex } from "./spaShell";

export function marketCardInput(file: PublicMarketFile): DeskTakeCardInput {
  const lead = file.references[0];
  return {
    format: "market",
    category: file.market.state,
    take: `${file.market.name}. ${lead?.title ?? "The evidence gap is visible."}`,
    storyTitle: "Read the evidence. Then question the view.",
    context: `${file.referenceCount} selected reporting references across 90 days. Coverage is not an investment ranking. Open the source trail at thedesk.au${marketPath(file.market.slug)}.`,
    source: lead?.publisher ?? "The Desk",
    feedDate: lead?.date ?? file.asOf,
  };
}

export function marketShell(
  shell: string,
  file: PublicMarketFile,
  directory: MarketDirectory,
  base: string
): string {
  const canonical = `${base}${marketPath(file.market.slug)}`;
  const title = `${file.market.name} property intelligence`;
  const description = file.references[0]
    ? `${file.market.name}: ${file.references[0].title} — inspect dated reporting, evidence gaps and compare markets with The Desk.`
    : `Inspect The Desk's reporting coverage for ${file.market.name}, see the gaps and ask a sourced property question.`;
  let html = injectMeta(shell, {
    title,
    description: description.slice(0, 300),
    ogTitle: `${file.market.name} | The Market File`,
    ogDescription: description.slice(0, 300),
    canonical,
    ogImage:
      file.referenceCount && !directory.demo
        ? `${base}/og/markets/${file.market.slug}.png`
        : `${base}/og-card.png`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: title,
      url: canonical,
      description: description.slice(0, 300),
      ...(file.latestMention ? { dateModified: file.latestMention } : {}),
      hasPart: file.references.map((reference) => ({
        "@type": "Article",
        headline: reference.title,
        url: `${base}/story/${reference.id}`,
        datePublished: reference.date,
      })),
    },
  }).replace(
    '<meta property="og:type" content="article"',
    '<meta property="og:type" content="website"'
  );
  if (file.referenceCount && !directory.demo) {
    for (const [property, value] of [
      ["og:image:width", "1080"],
      ["og:image:height", "1350"],
    ]) {
      const tag = `<meta property="${property}" content="${value}" />`;
      const pattern = new RegExp(
        `<meta\\s+property="${property}"\\s+content="[^"]*"\\s*\\/?>`,
        "i"
      );
      html = pattern.test(html)
        ? html.replace(pattern, tag)
        : html.replace("</head>", `${tag}</head>`);
    }
  }
  const content = renderToStaticMarkup(createElement(PublicMarketRead, { file, directory }));
  html = html.replace(
    '<div id="root"></div>',
    `<div id="root"><main class="max-w-6xl mx-auto px-5 py-8">${content}</main></div>`
  );
  return file.indexable ? html : withNoindex(html);
}

/** Same content for humans and crawlers. No model calls on public page/image reads. */
export function registerMarketSeoRoutes(app: Express): void {
  app.get("/markets/:slug", async (req, res, next) => {
    const accept = req.headers.accept ?? "*/*";
    if (!accept.includes("text/html") && !accept.includes("*/*")) return next();
    const slug = routeParam(req.params.slug);
    if (!publicMarket(slug)) {
      res.status(404);
      return next();
    }
    const shellPath = path.resolve(process.cwd(), "dist/public/index.html");
    if (!fs.existsSync(shellPath)) return next();
    try {
      const [shell, directory] = await Promise.all([
        fs.promises.readFile(shellPath, "utf8"),
        getMarketDirectory(),
      ]);
      const file = directory.markets.find((item) => item.market.slug === slug);
      if (!file) {
        res.status(404);
        return next();
      }
      res.set("Cache-Control", "public, max-age=60");
      res.type("html").send(marketShell(shell, file, directory, siteUrl()));
    } catch {
      // A database outage must not publish a successful empty page to search engines.
      res.set("Cache-Control", "no-store");
      res.set("Retry-After", "60");
      res
        .status(503)
        .type("html")
        .send(
          '<!doctype html><html lang="en"><head><title>Market file temporarily unavailable | The Desk</title></head><body><h1>Market file temporarily unavailable</h1><p>Please try again shortly.</p><a href="/markets">Back to Markets</a></body></html>'
        );
    }
  });
  app.get("/og/markets/:slug.png", async (req, res) => {
    const slug = routeParam(req.params.slug);
    if (!publicMarket(slug)) {
      res.status(404).end();
      return;
    }
    try {
      const directory = await getMarketDirectory();
      const file = directory.markets.find((item) => item.market.slug === slug);
      if (!file?.referenceCount || directory.demo) {
        res.status(404).end();
        return;
      }
      const input = marketCardInput(file);
      const png = await cached(`market-card:${slug}`, 60_000, () => renderDeskTakeCard(input));
      res.set("Cache-Control", "public, max-age=60");
      res.type("png").send(png);
    } catch {
      res.set("Cache-Control", "no-store").status(503).end();
    }
  });
}
