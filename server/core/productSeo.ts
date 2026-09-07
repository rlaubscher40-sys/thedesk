import type { Express, NextFunction, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SITE_URL } from "../../shared/const";

function siteUrl(): string {
  return (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");
}

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
  const pattern = new RegExp(
    `<meta\\s+${attribute}="${safeKey}"\\s+content="[^"]*"\\s*\\/?>`,
    "i"
  );
  const tag = `<meta ${attribute}="${key}" content="${escaped}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

function replaceCanonical(html: string, canonical: string): string {
  const tag = `<link rel="canonical" href="${htmlEscape(canonical)}" />`;
  const pattern = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
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
  const accept = req.headers.accept ?? "";
  if (!accept.includes("text/html")) return next();

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

  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(html);
}

const PRODUCT_META: ProductMeta[] = [
  {
    path: "/",
    title: "The Desk: Australian property intelligence before it becomes consensus",
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

/**
 * Product pages deserve their own search/social proposition instead of all
 * inheriting the old "60-second briefing" homepage metadata. Dynamic shared
 * signal links are handled earlier by distributionSeo; this route owns the
 * generic product landing pages that fall through.
 */
export function registerProductSeoRoutes(app: Express): void {
  for (const meta of PRODUCT_META) {
    app.get(meta.path, (req, res, next) => {
      void sendProductShell(req, res, next, meta).catch((error) => {
        console.warn(`[product-seo] ${meta.path} meta failed:`, (error as Error).message);
        next();
      });
    });
  }
}
