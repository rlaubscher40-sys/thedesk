/**
 * Regression guard for the WebP hero that silently killed the weekly
 * Instagram post.
 *
 * The edition hero generator (server/core/image.ts) prefers WebP, but
 * satori's image decoder only understands PNG/JPEG — a WebP backgroundImage
 * throws "u is not iterable" mid-layout, which bubbled up as a 502 on every
 * Sunday's weekly carousel while the daily posts (which don't use this hero)
 * kept working. loadEditionHeroDataUri must transcode anything that isn't
 * already PNG/JPEG to JPEG so the renderers never see a format satori chokes
 * on. This test fails loudly if that transcode is ever removed.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import sharp from "sharp";

const getLatestEditionAsset = vi.fn();
vi.mock("../db/editionAssets", () => ({
  getLatestEditionAsset: (...args: unknown[]) => getLatestEditionAsset(...args),
}));

import { loadEditionHeroDataUri } from "./post";
import { renderWeeklyCoverCard } from "../og/instagramCards";
import type { Edition } from "../db/schema";
import type { EditionTopic } from "../../shared/schemas";

async function solid(format: "webp" | "png" | "jpeg"): Promise<Buffer> {
  const img = sharp({
    create: { width: 1080, height: 1350, channels: 3, background: { r: 12, g: 18, b: 32 } },
  });
  return (format === "webp" ? img.webp() : format === "png" ? img.png() : img.jpeg()).toBuffer();
}

function fakeEdition(): Edition {
  const topic: EditionTopic = {
    title: "RBA holds the cash rate at 3.85%",
    summary: "The Reserve Bank left the cash rate unchanged at its June meeting.",
    category: "MACRO" as never,
    whatToWatch: ["Q3 fixed-rate rolloffs"],
  };
  return {
    id: 1, editionNumber: 5, weekOf: "2026-06-01", weekRange: "Jun 1-7",
    publishedAt: new Date(), pdfUrl: null, readingTime: "8 min", topics: [topic],
    signals: [], fullText: null, keyMetrics: { cashRate: "3.85%", asx200: "8,210" },
    heroImageUrl: null, rubensTake: "A steady week for rates.", substackDraftTitle: null,
    substackDraftSubtitle: null, substackDraftBody: null, substackDraftImageUrl: null,
    marketStress: "low", datesToWatch: null, lookback: null, metaTitle: null,
    metaDescription: null, socialTitle: null, socialDescription: null,
    headlineVariants: null, createdAt: new Date(),
  } as Edition;
}

describe("loadEditionHeroDataUri — satori-safe hero format", () => {
  beforeEach(() => getLatestEditionAsset.mockReset());

  it("transcodes a WebP hero to a JPEG data URI", async () => {
    getLatestEditionAsset.mockResolvedValue({
      contentType: "image/webp",
      bytes: await solid("webp"),
    });
    const uri = await loadEditionHeroDataUri(1);
    expect(uri?.startsWith("data:image/jpeg;base64,")).toBe(true);
  });

  it("passes PNG/JPEG heroes through untouched", async () => {
    getLatestEditionAsset.mockResolvedValue({
      contentType: "image/png",
      bytes: await solid("png"),
    });
    const uri = await loadEditionHeroDataUri(1);
    expect(uri?.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("returns null (not a throw) when no hero asset exists", async () => {
    getLatestEditionAsset.mockResolvedValue(null);
    expect(await loadEditionHeroDataUri(1)).toBeNull();
  });

  it("the transcoded hero actually renders through satori", async () => {
    getLatestEditionAsset.mockResolvedValue({
      contentType: "image/webp",
      bytes: await solid("webp"),
    });
    const uri = await loadEditionHeroDataUri(1);
    // The whole point: satori must be able to embed what the loader returns.
    const buf = await renderWeeklyCoverCard(fakeEdition(), uri);
    expect(buf.length).toBeGreaterThan(1000);
  });
});
