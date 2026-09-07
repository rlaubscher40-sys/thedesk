import {
  PublicComparisonRead,
  PUBLIC_COMPARISON_PATH,
  PUBLIC_COMPARISON_TITLE,
  comparisonRentSummary,
} from "../../shared/PublicComparisonRead";
import { getCityRents } from "../markets/absRents";
import { rentGap, type CityRents } from "../../shared/cityRents";
import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicMarketRead } from "../../shared/PublicMarketRead";
import { latestRent, rentIsOlder, rentPeriod } from "../../shared/cityRents";
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
  const rent = latestRent(file.rents, file.market.name);
  if (rent)
    return {
      format: "market",
      category: file.market.state,
      take: `${file.market.name}. Annual rent growth.`,
      figure: `${rent.annualPercent.toFixed(1)}%`,
      storyTitle: `Rents actually paid · Year to ${rentPeriod(rent.period)}`,
      context: `${rentIsOlder(rent, file.asOf) ? "Older observation. " : ""}${rent.status === "p" ? "Preliminary. " : rent.status === "r" ? "Revised. " : ""}ABS CPI capital-city series, original. Not asking rents, yields or an investment ranking. Inspect the source at thedesk.au${marketPath(file.market.slug)}.`,
      source: "Australian Bureau of Statistics",
      feedDate: rent.period,
    };
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
      (file.referenceCount || latestRent(file.rents, file.market.name)) && !directory.demo
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
  if ((file.referenceCount || latestRent(file.rents, file.market.name)) && !directory.demo) {
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

export const PUBLIC_COMPARISON_IMAGE = "/og/markets/compare/brisbane-vs-perth.png";
export function publicComparisonCard(data: CityRents, asOf: string): DeskTakeCardInput | null {
  const a = latestRent(data, "Brisbane"),
    b = latestRent(data, "Perth");
  const gap = rentGap(a, b, asOf);
  if (gap === null || !a || !b) return null;
  const qualifiers = [a, b]
    .filter((row) => row.status)
    .map((row) => `${row.city}: ${row.status === "p" ? "preliminary" : "revised"}.`)
    .join(" ");
  return {
    format: "market",
    category: "Brisbane vs Perth",
    take:
      gap === 0
        ? "Same rent growth. An open investment question."
        : `${gap > 0 ? "Brisbane" : "Perth"} rents grew faster. That is only part of the case.`,
    figure: `${Math.abs(gap).toFixed(1)}pp`,
    storyTitle: `Annual rent growth: Brisbane ${a.annualPercent.toFixed(1)}% · Perth ${b.annualPercent.toFixed(1)}%`,
    context: `Year to ${rentPeriod(a.period)}. ${qualifiers} ABS CPI rents actually paid, original. Not asking rents, yields or an investment ranking. Read the evidence gaps at thedesk.au${PUBLIC_COMPARISON_PATH}.`,
    source: "Australian Bureau of Statistics",
    feedDate: a.period,
  };
}

export function publicComparisonShell(
  shell: string,
  data: CityRents,
  asOf: string,
  base: string
): string {
  const canonical = `${base}${PUBLIC_COMPARISON_PATH}`;
  const description = comparisonRentSummary(data, asOf);
  const content = renderToStaticMarkup(createElement(PublicComparisonRead, { data, asOf }));
  let html = injectMeta(shell, {
    title: PUBLIC_COMPARISON_TITLE,
    description,
    ogTitle: "Brisbane vs Perth | The Desk",
    ogDescription: description,
    canonical,
    ogImage: `${base}${publicComparisonCard(data, asOf) ? PUBLIC_COMPARISON_IMAGE : "/og-card.png"}`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: PUBLIC_COMPARISON_TITLE,
      url: canonical,
      description,
    },
  }).replace(
    '<div id="root"></div>',
    `<div id="root"><main class="max-w-6xl mx-auto px-5 py-8">${content}</main></div>`
  );
  html = html.replace(
    '<meta property="og:type" content="article"',
    '<meta property="og:type" content="website"'
  );
  if (publicComparisonCard(data, asOf)) {
    for (const [property, value] of [
      ["og:image:width", "1080"],
      ["og:image:height", "1350"],
    ]) {
      html = html
        .replace(new RegExp(`<meta\\s+property="${property}"[^>]*>`, "i"), "")
        .replace("</head>", `<meta property="${property}" content="${value}" /></head>`);
    }
  }
  return rentGap(latestRent(data, "Brisbane"), latestRent(data, "Perth"), asOf) === null
    ? withNoindex(html)
    : html;
}

/** Same content for humans and crawlers. No model calls on public page/image reads. */
export function registerMarketSeoRoutes(app: Express): void {
  app.get(PUBLIC_COMPARISON_IMAGE, async (_req, res) => {
    try {
      const data = await getCityRents();
      const asOf = new Date().toISOString().slice(0, 10);
      const input = publicComparisonCard(data, asOf);
      if (!input) {
        res.set("Cache-Control", "no-store").status(404).end();
        return;
      }
      const png = await cached(`public-comparison-card:${JSON.stringify(input)}`, 60_000, () =>
        renderDeskTakeCard(input)
      );
      res.set("Cache-Control", "public, max-age=60").type("png").send(png);
    } catch {
      res.set("Cache-Control", "no-store").status(503).end();
    }
  });
  app.get(PUBLIC_COMPARISON_PATH, async (req, res, next) => {
    const accept = req.headers.accept ?? "*/*";
    if (!accept.includes("text/html") && !accept.includes("*/*")) return next();
    const shellPath = path.resolve(process.cwd(), "dist/public/index.html");
    if (!fs.existsSync(shellPath)) return next();
    try {
      const [shell, rents] = await Promise.all([
        fs.promises.readFile(shellPath, "utf8"),
        getCityRents(),
      ]);
      res.set("Cache-Control", rents.status === "available" ? "public, max-age=60" : "no-store");
      res
        .type("html")
        .send(
          publicComparisonShell(shell, rents, new Date().toISOString().slice(0, 10), siteUrl())
        );
    } catch {
      res
        .set("Cache-Control", "no-store")
        .set("Retry-After", "60")
        .status(503)
        .type("html")
        .send("<h1>Comparison temporarily unavailable</h1><p>Please try again shortly.</p>");
    }
  });
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
      if (
        !file ||
        (!file.referenceCount && !latestRent(file.rents, file.market.name)) ||
        directory.demo
      ) {
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
