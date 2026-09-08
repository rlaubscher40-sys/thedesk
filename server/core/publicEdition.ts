import type { Edition } from "../db/schema";
/** Explicit allow-list: adding an editor/database column can never publish it. */
export function publicEdition(ed: Edition) {
  return {
    id: ed.id,
    editionNumber: ed.editionNumber,
    weekOf: ed.weekOf,
    weekRange: ed.weekRange,
    publishedAt: ed.publishedAt,
    pdfUrl: ed.pdfUrl,
    readingTime: ed.readingTime,
    topics: ed.topics,
    signals: ed.signals,
    fullText: ed.fullText,
    keyMetrics: ed.keyMetrics,
    heroImageUrl: ed.heroImageUrl,
    rubensTake: ed.rubensTake,
    marketStress: ed.marketStress,
    datesToWatch: ed.datesToWatch,
    lookback: ed.lookback,
    metaTitle: ed.metaTitle,
    metaDescription: ed.metaDescription,
    socialTitle: ed.socialTitle,
    socialDescription: ed.socialDescription,
    createdAt: ed.createdAt,
  };
}
