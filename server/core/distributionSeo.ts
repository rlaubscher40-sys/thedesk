import type { Express, NextFunction, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SITE_URL } from "../../shared/const";
import * as db from "../db";
import { renderDailyHookCoverCard } from "../core/publicRender";
import { renderIntelligenceCard } from "../core/publicRender";
import { renderSignalCard } from "../core/publicRender";
import { renderTrendCard } from "../core/publicRender";
import { readIntelligenceShareToken } from "./intelligenceShare";

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

function clean(value: string | null | undefined, max = 240): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.62 ? cut.slice(0, at) : cut).trim()}…`;
}

function firstQuery(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

function briefToken(req: Request): string {
  return firstQuery(req.query.t) || firstQuery(req.query.token);
}

function replaceMeta(
  html: string,
  attribute: "name" | "property",
  key: string,
  content: string
): string {
  const escaped = htmlEscape(content);
  const pattern = new RegExp(
    `<meta\\s+${attribute}="${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s+content="[^"]*"\\s*\\/?>`,
    "i"
  );
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

type SocialMeta = {
  title: string;
  description: string;
  canonical: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  type?: "website" | "article";
  noindex?: boolean;
};

async function sendSocialShell(
  req: Request,
  res: Response,
  next: NextFunction,
  meta: SocialMeta
): Promise<void> {
  const accept = req.headers.accept ?? "";
  if (!accept.includes("text/html")) return next();

  const indexPath = path.resolve(process.cwd(), "dist", "public", "index.html");
  if (!fs.existsSync(indexPath)) return next();

  let html = await fs.promises.readFile(indexPath, "utf8");
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${htmlEscape(meta.title)}</title>`);
  html = replaceMeta(html, "name", "description", meta.description);
  html = replaceMeta(html, "property", "og:type", meta.type ?? "website");
  html = replaceMeta(html, "property", "og:url", meta.canonical);
  html = replaceMeta(html, "property", "og:title", meta.title);
  html = replaceMeta(html, "property", "og:description", meta.description);
  html = replaceMeta(html, "property", "og:image", meta.image);
  html = replaceMeta(html, "property", "og:image:width", String(meta.imageWidth));
  html = replaceMeta(html, "property", "og:image:height", String(meta.imageHeight));
  html = replaceMeta(html, "name", "twitter:card", "summary_large_image");
  html = replaceMeta(html, "name", "twitter:title", meta.title);
  html = replaceMeta(html, "name", "twitter:description", meta.description);
  html = replaceMeta(html, "name", "twitter:image", meta.image);
  html = replaceCanonical(html, meta.canonical);
  if (meta.noindex) html = replaceMeta(html, "name", "robots", "noindex, nofollow, noarchive");

  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", meta.noindex ? "private, no-cache" : "no-cache");
  res.send(html);
}

function displayValue(value: string, unit: string | null): string {
  const cleanValue = value.trim();
  const cleanUnit = unit?.trim();
  if (!cleanUnit) return cleanValue;
  if (cleanUnit === "%" && cleanValue.includes("%")) return cleanValue;
  if (cleanUnit === "$" && cleanValue.startsWith("$")) return cleanValue;
  if (["%", "°", "x"].includes(cleanUnit)) return `${cleanValue}${cleanUnit}`;
  if (cleanUnit === "$") return `$${cleanValue}`;
  return `${cleanValue} ${cleanUnit}`;
}

function pctMove(first: number, last: number): number {
  if (Math.abs(first) < 0.000001) return last - first;
  return ((last - first) / Math.abs(first)) * 100;
}

function formatMove(series: Array<{ value: number; recordedAt: Date }>): string | null {
  if (series.length < 2) return null;
  const first = series[0]?.value;
  const last = series[series.length - 1]?.value;
  if (typeof first !== "number" || typeof last !== "number") return null;
  const move = pctMove(first, last);
  if (!Number.isFinite(move)) return null;
  return `${move > 0 ? "+" : ""}${move.toFixed(Math.abs(move) >= 10 ? 1 : 2)}% across 30-day recorded history`;
}

function formatAsOf(value: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(value);
}

async function getMetricPresentation(metricKey: string) {
  const [metrics, histories, editions] = await Promise.all([
    db.listDailyMetrics(),
    db.listMetricHistories(30),
    db.listEditionSummaries(),
  ]);
  const metric = metrics.find((row) => row.metricKey === metricKey);
  if (!metric) return null;
  const series = histories[metric.metricKey] ?? [];
  return {
    metric,
    series,
    value: displayValue(metric.value, metric.unit),
    move: formatMove(series),
    deskTake: editions.find((edition) => edition.rubensTake?.trim())?.rubensTake ?? null,
  };
}

async function handleBriefMeta(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = briefToken(req);
  if (!token) return next();
  try {
    const brief = readIntelligenceShareToken(token);
    if (!brief) return next();
    const canonical = `${siteUrl()}/brief?t=${encodeURIComponent(token)}`;
    await sendSocialShell(req, res, next, {
      title: `${clean(brief.headline, 110)} | The Desk`,
      description: clean(brief.answer, 220),
      canonical,
      image: `${siteUrl()}/og/brief.png?t=${encodeURIComponent(token)}`,
      imageWidth: 1080,
      imageHeight: 1350,
      type: "article",
      noindex: true,
    });
  } catch (error) {
    console.warn("[distribution-seo] brief meta failed:", (error as Error).message);
    next();
  }
}

async function handleBriefOg(req: Request, res: Response): Promise<void> {
  try {
    const token = briefToken(req);
    const brief = token ? readIntelligenceShareToken(token) : null;
    if (!brief) {
      res.redirect(302, "/og-card.png");
      return;
    }
    const png = await renderIntelligenceCard(brief);
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(png);
  } catch (error) {
    console.warn("[distribution-seo] brief OG failed:", (error as Error).message);
    res.redirect(302, "/og-card.png");
  }
}

async function handleSignalMeta(req: Request, res: Response, next: NextFunction): Promise<void> {
  const metricKey = firstQuery(req.query.metric).slice(0, 64);
  if (!metricKey) return next();
  try {
    const presented = await getMetricPresentation(metricKey);
    if (!presented) return next();
    const { metric, value, move, series } = presented;
    const wantsChart = firstQuery(req.query.view).toLowerCase() === "chart" && series.length >= 2;
    const basePath = `/signals?metric=${encodeURIComponent(metric.metricKey)}`;
    const canonical = `${siteUrl()}${basePath}${wantsChart ? "&view=chart" : ""}`;
    const movement = move ? ` ${move}.` : "";
    await sendSocialShell(req, res, next, {
      title: wantsChart
        ? `${clean(metric.label, 90)} | The Chart · The Desk`
        : `${value} · ${clean(metric.label, 80)} | The Number`,
      description: clean(
        wantsChart
          ? `${metric.context ?? "Thirty-day Australian property signal."}${movement}`
          : `${metric.context ?? "Live Australian property signal."}${movement}`,
        220
      ),
      canonical,
      image: wantsChart
        ? `${siteUrl()}/og/charts/${encodeURIComponent(metric.metricKey)}.png`
        : `${siteUrl()}/og/signals/${encodeURIComponent(metric.metricKey)}.png`,
      imageWidth: 1080,
      imageHeight: 1350,
      type: "website",
    });
  } catch (error) {
    console.warn("[distribution-seo] signal meta failed:", (error as Error).message);
    next();
  }
}

async function handleSignalOg(req: Request, res: Response): Promise<void> {
  try {
    const metricKey = decodeURIComponent(String(req.params.metricKey ?? "")).slice(0, 64);
    const presented = await getMetricPresentation(metricKey);
    if (!presented) {
      res.redirect(302, "/og-card.png");
      return;
    }
    const { metric, value, move, deskTake } = presented;
    const png = await renderSignalCard({
      label: metric.label,
      value,
      context: metric.context ?? null,
      move,
      deskTake,
      source: metric.source ?? null,
      asOf: formatAsOf(metric.asOf),
    });
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=1800");
    res.send(png);
  } catch (error) {
    console.warn("[distribution-seo] signal OG failed:", (error as Error).message);
    res.redirect(302, "/og-card.png");
  }
}

async function handleChartOg(req: Request, res: Response): Promise<void> {
  try {
    const metricKey = decodeURIComponent(String(req.params.metricKey ?? "")).slice(0, 64);
    const presented = await getMetricPresentation(metricKey);
    if (!presented || presented.series.length < 2) {
      res.redirect(302, "/og-card.png");
      return;
    }
    const { metric, value, series } = presented;
    const png = await renderTrendCard({
      label: metric.label,
      value,
      unit: null,
      context: metric.context ?? null,
      source: metric.source ?? null,
      asOf: formatAsOf(metric.asOf),
      series,
    });
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=1800");
    res.send(png);
  } catch (error) {
    console.warn("[distribution-seo] chart OG failed:", (error as Error).message);
    res.redirect(302, "/og-card.png");
  }
}

async function handleStoryMeta(req: Request, res: Response, next: NextFunction): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return next();
  try {
    const item = await db.getFeedItemById(id);
    if (!item) return next();
    const canonical = `${siteUrl()}/story/${item.id}`;
    await sendSocialShell(req, res, next, {
      title: `${clean(item.title, 115)} | The Desk`,
      description: clean(item.whyItMatters || item.summary, 220),
      canonical,
      image: `${siteUrl()}/og/story/${item.id}.jpg`,
      imageWidth: 1080,
      imageHeight: 1350,
      type: "article",
    });
  } catch (error) {
    console.warn("[distribution-seo] story meta failed:", (error as Error).message);
    next();
  }
}

async function handleStoryOg(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.redirect(302, "/og-card.png");
    return;
  }
  try {
    const item = await db.getFeedItemById(id);
    if (!item) {
      res.redirect(302, "/og-card.png");
      return;
    }
    const jpeg = await renderDailyHookCoverCard({
      feedDate: item.feedDate,
      lead: {
        title: item.title,
        category: item.category,
        source: item.source,
        whyItMatters: item.whyItMatters || item.summary,
      },
    });
    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(jpeg);
  } catch (error) {
    console.warn("[distribution-seo] story OG failed:", (error as Error).message);
    res.redirect(302, "/og-card.png");
  }
}

/**
 * Social distribution is a product surface. These server-side routes make
 * WhatsApp, iMessage, LinkedIn, X and Slack see the actual intelligence object
 * rather than the generic homepage shell before the SPA has a chance to run.
 */
export function registerDistributionSeoRoutes(app: Express): void {
  app.get("/og/brief.png", handleBriefOg);
  app.get("/og/signals/:metricKey.png", handleSignalOg);
  app.get("/og/charts/:metricKey.png", handleChartOg);
  app.get("/og/story/:id.jpg", handleStoryOg);
  app.get("/brief", handleBriefMeta);
  app.get("/signals", handleSignalMeta);
  app.get("/story/:id", handleStoryMeta);
}
