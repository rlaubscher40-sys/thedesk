import { acceptsHtml } from "./acceptsHtml";
import type { Express, NextFunction, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { siteUrl } from "./siteUrl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentarySources } from "../../shared/DocumentarySources";
import { getMarketDirectory } from "../markets/discovery";
import { marketPath } from "../../shared/marketDirectory";
import { PROPERTY_GUIDES, propertyGuide } from "../../shared/propertyGuides";
import { RentPressureRead } from "../../shared/RentPressureRead";
import { PropertyGuideRead } from "../../shared/PropertyGuideRead";
import { ProjectFollowThroughRead } from "../../shared/ProjectFollowThroughRead";

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function replaceMeta(
  html: string,
  attribute: "name" | "property",
  key: string,
  content: string
): string {
  const escaped = htmlEscape(content);
  const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta\\s+${attribute}="${safeKey}"\\s+content="[^"]*"\\s*\\/?>`, "i");
  const tag = `<meta ${attribute}="${key}" content="${escaped}" />`;
  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace("</head>", `    ${tag}\n  </head>`);
}

function replaceCanonical(html: string, canonical: string): string {
  const tag = `<link rel="canonical" href="${htmlEscape(canonical)}" />`;
  const pattern = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i;
  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace("</head>", `    ${tag}\n  </head>`);
}

type ProductMeta = {
  path: string;
  title: string;
  description: string;
};

async function sendProductShell(
  req: Request,
  res: Response,
  next: NextFunction,
  meta: ProductMeta
): Promise<void> {
  if (!acceptsHtml(req.headers.accept)) return next();

  const indexPath = path.resolve(process.cwd(), "dist", "public", "index.html");
  if (!fs.existsSync(indexPath)) return next();

  const canonical = `${siteUrl()}${meta.path}`;
  const image = `${siteUrl()}/og-card.png`;
  let html = await fs.promises.readFile(indexPath, "utf8");
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${htmlEscape(meta.title)}</title>`);
  html = replaceMeta(html, "name", "description", meta.description);
  html = replaceMeta(html, "property", "og:type", "website");
  html = replaceMeta(html, "property", "og:url", canonical);
  html = replaceMeta(html, "property", "og:title", meta.title);
  html = replaceMeta(html, "property", "og:description", meta.description);
  html = replaceMeta(html, "property", "og:image", image);
  html = replaceMeta(html, "name", "twitter:card", "summary_large_image");
  html = replaceMeta(html, "name", "twitter:title", meta.title);
  html = replaceMeta(html, "name", "twitter:description", meta.description);
  html = replaceMeta(html, "name", "twitter:image", image);
  html = replaceCanonical(html, canonical);
  if (meta.path === "/analysis/rent-pressure") {
    const content = renderToStaticMarkup(createElement(RentPressureRead));
    html = html.replace('<div id="root"></div>', `<div id="root"><main>${content}</main></div>`);
  }
  if (meta.path === "/social") {
    const sources = renderToStaticMarkup(createElement(DocumentarySources));
    html = html.replace(
      '<div id="root"></div>',
      `<div id="root"><main class="max-w-6xl mx-auto px-5 py-8"><h1>From the post to the evidence.</h1>${sources}</main></div>`
    );
  }
  if (meta.path === "/projects") {
    const content = renderToStaticMarkup(createElement(ProjectFollowThroughRead, {}));
    html = html.replace('<div id="root"></div>', `<div id="root">${content}</div>`);
    html = html.replace(
      "The Desk needs JavaScript to display this page.",
      "The method and limits of this tracker are readable without JavaScript. Enable JavaScript to load the cohort."
    );
  }
  if (meta.path === "/guides" || meta.path.startsWith("/guides/")) {
    const guide = propertyGuide(meta.path.slice(8));
    const content = renderToStaticMarkup(createElement(PropertyGuideRead, { guide }));
    html = html.replace('<div id="root"></div>', `<div id="root"><main>${content}</main></div>`);
    html = html.replace(
      "The Desk needs JavaScript to display this page.",
      "This guide is readable without JavaScript. Enable JavaScript to use interactive tools."
    );
  }

  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(html);
}

const PRODUCT_META: ProductMeta[] = [
  {
    path: "/analysis/rent-pressure",
    title: "Rent pressure monitor: July 2026 | The Desk",
    description:
      "Is rent growth easing across Australia’s capitals? A reproducible analysis of ABS annual rent changes, with inputs, calculations, chart and limitations.",
  },
  {
    path: "/partners",
    title: "Partner with The Desk",
    description:
      "Discuss support for Australian property explanation, with clear commercial disclosure and editorial independence.",
  },
  {
    path: "/guides",
    title: "Property explained | The Desk",
    description:
      "Short, sourced guides to Australian housing supply, interest rates, rents, prices, migration, auctions and social housing. Understand the headline, then follow the evidence.",
  },
  ...PROPERTY_GUIDES.map((guide) => ({
    path: `/guides/${guide.slug}`,
    title: `${guide.title} | The Desk`,
    description: guide.intro,
  })),
  {
    path: "/projects",
    title: "Project follow-through | The Desk",
    description:
      "Follow a small cohort of Sydney housing applications through dated, source-backed milestones. A determination is not an approval, and construction is not assumed.",
  },
  {
    path: "/social",
    title: "Reel sources and property evidence | The Desk",
    description:
      "Read the sources, historical context and limitations behind The Desk's Australian property Reels and documentaries.",
  },
  {
    path: "/archive",
    title: "Australian property news archive | The Desk",
    description:
      "Search The Desk's dated reporting on Australian property, lending, supply and the economy.",
  },
  {
    path: "/editions",
    title: "Weekly property intelligence editions | The Desk",
    description:
      "Read The Desk's weekly editions, with sourced property reporting, market signals and analysis.",
  },
  {
    path: "/trends",
    title: "Property and economic trends | The Desk",
    description: "Explore trends across The Desk's property, market and economic reporting.",
  },
  {
    path: "/topics",
    title: "Property news by topic | The Desk",
    description:
      "Follow Australian property, macroeconomics, markets and business through The Desk's topic threads.",
  },
  {
    path: "/about",
    title: "About The Desk | Australian property intelligence",
    description:
      "Learn about The Desk, curated by Ruben Laubscher, and how to use its daily reporting, weekly editions and sourced market evidence.",
  },
  {
    path: "/editorial-standards",
    title: "Editorial standards | The Desk",
    description:
      "How The Desk handles sourcing, verification, AI assistance, corrections and editorial independence.",
  },
  {
    path: "/corrections",
    title: "Corrections and feedback | The Desk",
    description:
      "Review The Desk's published corrections and report an error in its property reporting or market evidence.",
  },
  {
    path: "/privacy",
    title: "Privacy policy | The Desk",
    description:
      "How The Desk handles personal information, subscriptions, analytics and your privacy choices.",
  },
  {
    path: "/terms",
    title: "Terms of use | The Desk",
    description:
      "The terms for using The Desk's property intelligence, reporting, market data and tools.",
  },
  {
    path: "/subscribe",
    title: "The free daily brief | The Desk",
    description:
      "Get The Desk's national Australian property, credit and economy briefing by email. Free to subscribe, with email confirmation and one-click unsubscribe.",
  },
  {
    path: "/",
    title: "The Desk: Australian property news, evidence and explanation",
    description:
      "Know what changed, ask grounded property questions, inspect Australian markets, watch live signals and share the intelligence that matters.",
  },
  {
    path: "/ask",
    title: "Ask The Desk | Grounded Australian property intelligence",
    description:
      "Ask an Australian property question and get a sourced intelligence brief built from The Desk archive and live market signals, not a generic AI answer.",
  },
  {
    path: "/markets",
    title: "Markets | The Desk Australian property intelligence",
    description:
      "Build a live market file for an Australian city, region or suburb, then interrogate the evidence across prices, rents, supply, lending, migration and risk.",
  },
  {
    path: "/signals",
    title: "Signals | What is moving now in Australian property",
    description:
      "Watch the live numbers moving Australian property, track changes from your own baseline and turn any signal into a sourced Desk intelligence question.",
  },
];

const PRODUCT_SITEMAP_PATHS = [
  "/ask",
  "/markets",
  "/signals",
  "/analysis/rent-pressure",
  "/partners",
] as const;

/**
 * Product pages deserve their own search/social proposition instead of all
 * inheriting the old "60-second briefing" homepage metadata. Dynamic shared
 * signal links are handled earlier by distributionSeo; this route owns the
 * generic product landing pages that fall through.
 *
 * The editorial sitemap lives in seo.ts and is intentionally conservative.
 * Product surfaces are published separately so Ask / Markets / Signals can
 * evolve without coupling the editorial crawl contract to the app roadmap.
 */
export function registerProductSeoRoutes(app: Express): void {
  app.get("/product-sitemap.xml", async (_req, res) => {
    const base = siteUrl();
    const today = new Date().toISOString().slice(0, 10);
    const urls = PRODUCT_SITEMAP_PATHS.map((productPath) => {
      const frequency = productPath === "/signals" ? "daily" : "weekly";
      return `<url><loc>${base}${productPath}</loc><lastmod>${today}</lastmod><changefreq>${frequency}</changefreq></url>`;
    });
    try {
      const directory = await getMarketDirectory();
      for (const file of directory.markets) {
        if (file.indexable && file.latestMention)
          urls.push(
            `<url><loc>${htmlEscape(base)}${marketPath(file.market.slug)}</loc><lastmod>${file.latestMention}</lastmod><changefreq>daily</changefreq></url>`
          );
      }
    } catch {
      res.set("Cache-Control", "no-store").status(503).end();
      return;
    }
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`
    );
  });

  // Retired structured-data placeholder crawled literally by Google. Keep real searches intact.
  app.get("/archive", (req, res, next) => {
    if (req.query.q === "{search_term_string}") return res.redirect(301, "/archive");
    next();
  });

  for (const meta of PRODUCT_META) {
    app.get(meta.path, (req, res, next) => {
      void sendProductShell(req, res, next, meta).catch((error) => {
        console.warn(`[product-seo] ${meta.path} meta failed:`, (error as Error).message);
        next();
      });
    });
  }
}
